type ExerciseCategorySource = {
  muscle_group?: string | null;
  muscle_groups?: string[] | null;
};

export const EXERCISE_FILTER_CATEGORIES = [
  "Все",
  "Любимые",
  "Кардио",
  "Грудь",
  "Спина",
  "Бицепс",
  "Трицепс",
  "Квадрицепс",
  "Хамстринги",
  "Плечи",
  "Бедра",
  "Пресс",
  "Верхняя часть руки",
  "Икры",
  "Предплечья",
  "Шея",
] as const;

export const EXERCISE_ASSIGNABLE_CATEGORIES = [
  "Кардио",
  "Грудь",
  "Спина",
  "Бицепс",
  "Трицепс",
  "Квадрицепс",
  "Хамстринги",
  "Плечи",
  "Бедра",
  "Пресс",
  "Верхняя часть руки",
  "Икры",
  "Предплечья",
  "Шея",
] as const;

export type ExerciseFilterCategory = (typeof EXERCISE_FILTER_CATEGORIES)[number];
export type ExerciseAssignableCategory = (typeof EXERCISE_ASSIGNABLE_CATEGORIES)[number];

const CATEGORY_KEYWORDS: Record<ExerciseAssignableCategory, string[]> = {
  Грудь: ["груд", "pec"],
  Спина: ["спин", "широчайш", "ромбовид", "трапец"],
  Кардио: ["кардио", "бег", "дорожк", "ходьб", "эллипс", "велотрен", "скакал", "jump", "burpee", "air bike", "rower", "bike", "aerob"],
  Бицепс: ["бицепс"],
  Трицепс: ["трицепс"],
  Квадрицепс: ["квадрицепс"],
  Хамстринги: ["хамстр", "бицепс бедра", "задняя поверхность бедра"],
  Плечи: ["плеч", "дельт"],
  Бедра: ["бедр", "ягод", "привод", "отвод", "glute", "hip"],
  Пресс: ["пресс", "core", "кор", "живот", "абдомин", "поперечная мышца живота"],
  "Верхняя часть руки": ["верхняя часть руки", "upper arm", "руки", "бицепс", "трицепс", "плечевая мышца"],
  Икры: ["икр", "икронож", "камбаловид", "calf"],
  Предплечья: ["предплеч", "плечелуч", "forearm"],
  Шея: ["шея", "шейн", "neck"],
};

function normalize(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

function getExerciseTokens(exercise: ExerciseCategorySource) {
  return [exercise.muscle_group, ...(exercise.muscle_groups ?? [])]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(normalize);
}

export function getExerciseVisualCategory(
  exercise: ExerciseCategorySource
): ExerciseAssignableCategory | null {
  return (
    EXERCISE_ASSIGNABLE_CATEGORIES.find((category) => matchesExerciseCategory(exercise, category)) ??
    null
  );
}

const CATEGORY_ICON_PATHS: Partial<Record<ExerciseFilterCategory, string>> = {
  Грудь: "/category-icons/Грудь.svg",
  Спина: "/category-icons/Спина.svg",
  Кардио: "/category-icons/Кардио.svg",
  Бицепс: "/category-icons/Бицепс.svg",
  Трицепс: "/category-icons/Трицепс.svg",
  Квадрицепс: "/category-icons/Квадрицепс.svg",
  Хамстринги: "/category-icons/Хамстринги.svg",
  Плечи: "/category-icons/Плечи.svg",
  Бедра: "/category-icons/Бедра.svg",
  Пресс: "/category-icons/Пресс.svg",
  "Верхняя часть руки": "/category-icons/Бицепс.svg",
  Икры: "/category-icons/Икры.svg",
  Предплечья: "/category-icons/Предплечья.svg",
  Шея: "/category-icons/Шея.svg",
};

export function getExerciseCategoryIconPath(category: string) {
  if (category in CATEGORY_ICON_PATHS) {
    return CATEGORY_ICON_PATHS[category as ExerciseFilterCategory] ?? null;
  }

  return null;
}

export function matchesExerciseCategory(
  exercise: ExerciseCategorySource,
  category: string
) {
  if (category === "Все") return true;
  if (category === "Любимые") return false;

  if (!(category in CATEGORY_KEYWORDS)) {
    return normalize(exercise.muscle_group ?? "") === normalize(category);
  }

  const tokens = getExerciseTokens(exercise);
  const keywords = CATEGORY_KEYWORDS[category as ExerciseAssignableCategory];

  return tokens.some((token) => keywords.some((keyword) => token.includes(keyword)));
}
