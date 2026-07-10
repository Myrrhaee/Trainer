export type WorkoutSetEntry = {
  id: string;
  reps: string;
  weight: string;
  rest: string;
  rpe: string;
};

export type WorkoutBuilderExercise = {
  id: string;
  exercise_id: string;
  title: string;
  category: string | null;
  equipment: string | null;
  difficulty: string | null;
  description: string | null;
  imageUrl?: string | null;
  muscleGroups: string[];
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  comment: string;
  rpe: string;
  tempo: string;
  note: string;
  executionType: string;
  effortMode: string;
  expanded: boolean;
  perSetMode: boolean;
  setEntries: WorkoutSetEntry[];
};

export type WorkoutBuilderBlockType = "superset";

export type WorkoutBuilderBlock = {
  id: string;
  type: WorkoutBuilderBlockType;
  title: string;
  note: string;
  rounds: string;
  restBetweenRounds: string;
  expanded: boolean;
  exercises: WorkoutBuilderExercise[];
};

export type WorkoutBuilderDay = {
  id: string;
  name: string;
  trainingType: string;
  note: string;
  exercises: WorkoutBuilderExercise[];
  blocks: WorkoutBuilderBlock[];
};

export type WorkoutBuilderWeek = {
  id: string;
  name: string;
  days: WorkoutBuilderDay[];
};

export type WorkoutBuilderPlan = {
  weeks: WorkoutBuilderWeek[];
};
