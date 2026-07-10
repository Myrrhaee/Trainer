import type { SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseSchemaMismatch } from "@/lib/utils";

export type ExerciseLibraryRow = {
  id: string;
  title: string;
  muscle_group: string | null;
  image_url?: string | null;
  equipment: string | null;
  difficulty: string | null;
  description: string | null;
  technique_steps: string[];
  tips: string[];
  muscle_groups: string[];
  video_url: string | null;
  is_system: boolean;
  owner_user_id: string | null;
  source_exercise_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type LegacyExerciseRow = {
  id: string;
  title: string;
  muscle_group?: string | null;
  equipment?: string | null;
  difficulty?: string | null;
  description?: string | null;
  video_url?: string | null;
  trainer_id?: string | null;
  created_at?: string | null;
};

type ExerciseLibraryMutation = {
  title: string;
  muscle_group: string;
  equipment: string | null;
  difficulty: string | null;
  description: string | null;
  video_url: string | null;
};

type QueryResult<T> = {
  data: T;
  error: unknown;
};

const EXERCISE_LIBRARY_SELECT = [
  "id",
  "title",
  "muscle_group",
  "image_url",
  "equipment",
  "difficulty",
  "description",
  "technique_steps",
  "tips",
  "muscle_groups",
  "video_url",
  "is_system",
  "owner_user_id",
  "source_exercise_id",
  "created_at",
  "updated_at",
].join(", ");

function mapLegacyExercise(row: LegacyExerciseRow, ownerUserId: string): ExerciseLibraryRow {
  return {
    id: row.id,
    title: row.title,
    muscle_group: row.muscle_group ?? null,
    equipment: row.equipment ?? null,
    difficulty: row.difficulty ?? null,
    description: row.description ?? null,
    technique_steps: [],
    tips: [],
    muscle_groups: [],
    video_url: row.video_url ?? null,
    is_system: false,
    owner_user_id: row.trainer_id ?? ownerUserId,
    source_exercise_id: null,
    created_at: row.created_at ?? null,
    updated_at: row.created_at ?? null,
  };
}

export async function loadVisibleExerciseLibrary(
  supabase: SupabaseClient,
  userId: string
): Promise<QueryResult<ExerciseLibraryRow[]>> {
  const result = await supabase
    .from("exercise_library")
    .select(EXERCISE_LIBRARY_SELECT)
    .or(`is_system.eq.true,owner_user_id.eq.${userId}`)
    .order("is_system", { ascending: false })
    .order("title", { ascending: true });

  if (!result.error || !isSupabaseSchemaMismatch(result.error)) {
    return {
      data: ((result.data ?? []) as unknown) as ExerciseLibraryRow[],
      error: result.error,
    };
  }

  const legacy = await supabase
    .from("exercises")
    .select("id, title, muscle_group, description, video_url, trainer_id, created_at")
    .eq("trainer_id", userId)
    .order("title", { ascending: true });

  return {
    data: ((legacy.data ?? []) as LegacyExerciseRow[]).map((row) =>
      mapLegacyExercise(row, userId)
    ),
    error: legacy.error,
  };
}

export async function loadVisibleExerciseTitles(
  supabase: SupabaseClient,
  userId: string
): Promise<QueryResult<Array<Pick<ExerciseLibraryRow, "id" | "title">>>> {
  const result = await supabase
    .from("exercise_library")
    .select("id, title")
    .or(`is_system.eq.true,owner_user_id.eq.${userId}`)
    .limit(400);

  if (!result.error || !isSupabaseSchemaMismatch(result.error)) {
    return {
      data: ((result.data ?? []) as Array<{ id: string; title: string }>).map((row) => ({
        id: row.id,
        title: row.title,
      })),
      error: result.error,
    };
  }

  const legacy = await supabase
    .from("exercises")
    .select("id, title")
    .eq("trainer_id", userId)
    .limit(400);

  return {
    data: ((legacy.data ?? []) as Array<{ id: string; title: string }>).map((row) => ({
      id: row.id,
      title: row.title,
    })),
    error: legacy.error,
  };
}

export async function createCustomExercise(
  supabase: SupabaseClient,
  userId: string,
  payload: ExerciseLibraryMutation
): Promise<QueryResult<ExerciseLibraryRow | null>> {
  const result = await supabase
    .from("exercise_library")
    .insert({
      ...payload,
      is_system: false,
      owner_user_id: userId,
      source_exercise_id: null,
    })
    .select(EXERCISE_LIBRARY_SELECT)
    .single();

  if (!result.error || !isSupabaseSchemaMismatch(result.error)) {
    return {
      data: ((result.data ?? null) as unknown) as ExerciseLibraryRow | null,
      error: result.error,
    };
  }

  const legacy = await supabase
    .from("exercises")
    .insert({
      trainer_id: userId,
      title: payload.title,
      muscle_group: payload.muscle_group,
      description: payload.description,
      video_url: payload.video_url,
    })
    .select("id, title, muscle_group, description, video_url, trainer_id, created_at")
    .single();

  return {
    data: legacy.data ? mapLegacyExercise(legacy.data as LegacyExerciseRow, userId) : null,
    error: legacy.error,
  };
}

export async function updateOwnedExercise(
  supabase: SupabaseClient,
  userId: string,
  exerciseId: string,
  payload: ExerciseLibraryMutation
): Promise<QueryResult<ExerciseLibraryRow | null>> {
  const result = await supabase
    .from("exercise_library")
    .update(payload)
    .eq("id", exerciseId)
    .eq("owner_user_id", userId)
    .eq("is_system", false)
    .select(EXERCISE_LIBRARY_SELECT)
    .single();

  if (!result.error || !isSupabaseSchemaMismatch(result.error)) {
    return {
      data: ((result.data ?? null) as unknown) as ExerciseLibraryRow | null,
      error: result.error,
    };
  }

  const legacy = await supabase
    .from("exercises")
    .update({
      title: payload.title,
      muscle_group: payload.muscle_group,
      description: payload.description,
      video_url: payload.video_url,
    })
    .eq("id", exerciseId)
    .eq("trainer_id", userId)
    .select("id, title, muscle_group, description, video_url, trainer_id, created_at")
    .single();

  return {
    data: legacy.data ? mapLegacyExercise(legacy.data as LegacyExerciseRow, userId) : null,
    error: legacy.error,
  };
}

export async function deleteOwnedExercise(
  supabase: SupabaseClient,
  userId: string,
  exerciseId: string
): Promise<QueryResult<null>> {
  const result = await supabase
    .from("exercise_library")
    .delete()
    .eq("id", exerciseId)
    .eq("owner_user_id", userId)
    .eq("is_system", false);

  if (!result.error || !isSupabaseSchemaMismatch(result.error)) {
    return { data: null, error: result.error };
  }

  const legacy = await supabase
    .from("exercises")
    .delete()
    .eq("id", exerciseId)
    .eq("trainer_id", userId);

  return { data: null, error: legacy.error };
}

export async function copySystemExerciseToMyLibrary(
  supabase: SupabaseClient,
  exerciseId: string
): Promise<QueryResult<ExerciseLibraryRow | null>> {
  const result = await supabase.rpc("copy_system_exercise_to_my_library", {
    id: exerciseId,
  });

  if (!result.error) {
    const row = Array.isArray(result.data) ? result.data[0] ?? null : result.data ?? null;
    return {
      data: ((row ?? null) as unknown) as ExerciseLibraryRow | null,
      error: null,
    };
  }

  return {
    data: null,
    error: result.error,
  };
}
