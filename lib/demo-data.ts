import type { ExerciseLibraryRow } from "@/lib/exercise-library";
import { DEMO_CLIENT, DEMO_TRAINER } from "@/lib/demo-mode";

export type DemoDashboardMetric = {
  label: string;
  value: string;
  helper: string;
};

export type DemoAttentionItem = {
  id: string;
  clientName: string;
  label: string;
  description: string;
  priority: "Высокий" | "Средний" | "Низкий";
  action: string;
  secondaryAction: string;
  eventTime: string;
};

export type DemoRosterClient = {
  id: string;
  name: string;
  email: string;
  goal: string;
  status: string;
  currentWeight: string;
  lastActive: string;
  progress: string;
  program: string;
};

export type DemoProgram = {
  id: string;
  title: string;
  weeks: number;
  price: number;
  status: string;
  dayOptions: Array<{
    id: string;
    label: string;
    weekLabel: string;
  }>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getPublicExerciseAssetPath(folder: string, fileName: string) {
  return encodeURI(`/exercises/${folder}/${fileName}`);
}

function normalizeExerciseFileTitle(fileName: string) {
  return fileName
    .replace(/\.webp$/i, "")
    .replace(/:/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function inferBackEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("гантел")) return "Гантели";
  if (lower.includes("штанг") || lower.includes("т-гриф")) return "Штанга";
  if (lower.includes("гравитрон")) return "Гравитрон";
  if (lower.includes("резинк")) return "Резинка";
  if (lower.includes("подтягивания")) return "Турник";
  if (lower.includes("блока") || lower.includes("кабель") || lower.includes("канат")) return "Блок";
  if (lower.includes("рычаж") || lower.includes("тренажер") || lower.includes("тренажёр")) {
    return "Тренажёр";
  }
  return "Тренажёр";
}

function inferBackDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (
    lower.includes("гиперэкстенз") ||
    lower.includes("в гравитроне") ||
    lower.includes("с резинк") ||
    lower.includes("низкая")
  ) {
    return "Лёгкая";
  }
  if (
    lower.includes("становая") ||
    lower.includes("с весом") ||
    lower.includes("штанги в наклоне") ||
    lower.includes("широким хватом")
  ) {
    return "Сложная";
  }
  return "Средняя";
}

function inferBackMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("шраг")) return ["Трапеция", "Предплечья"];
  if (lower.includes("гиперэкстенз")) return ["Разгибатели спины", "Ягодицы", "Бицепс бедра"];
  if (lower.includes("становая")) return ["Разгибатели спины", "Ягодицы", "Бицепс бедра"];
  if (lower.includes("подтяг") || lower.includes("верхнего блока") || lower.includes("вертикальн")) {
    return ["Широчайшие", "Бицепс", "Верх спины"];
  }
  return ["Средняя часть спины", "Ромбовидные", "Бицепс"];
}

function createAutoBackExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", fileName),
    equipment: inferBackEquipment(title),
    difficulty: inferBackDifficulty(title),
    description: `${title} в клиентской библиотеке для работы над спиной и техникой тяговых движений.`,
    technique_steps: [
      "Подготовьте устойчивое исходное положение",
      "Выполните тяговое движение в рабочей амплитуде",
      "Вернитесь в старт под контролем без рывка",
    ],
    tips: ["Держите грудь раскрытой", "Двигайтесь через локоть и не теряйте контроль корпуса"],
    muscle_groups: inferBackMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function inferBicepsEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("ez-штанг") || lower.includes("штанг")) return "Штанга";
  if (lower.includes("гантел")) return "Гантели";
  if (lower.includes("блок")) return "Блок";
  if (lower.includes("рычаж") || lower.includes("скамье скотта") || lower.includes("скамья скотта")) {
    return "Тренажёр";
  }
  return "Гантели";
}

function inferBicepsDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("сидя") || lower.includes("на блоке") || lower.includes("в блоке")) {
    return "Лёгкая";
  }
  if (lower.includes("строгии") || lower.includes("строгий") || lower.includes("пауком")) {
    return "Сложная";
  }
  return "Средняя";
}

function inferBicepsMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("молот")) return ["Бицепс", "Плечелучевая мышца", "Предплечья"];
  if (lower.includes("над голов")) return ["Бицепс", "Длинная головка бицепса", "Предплечья"];
  return ["Бицепс", "Предплечья"];
}

function createAutoBicepsExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Бицепс",
    image_url: getPublicExerciseAssetPath("Biceps", fileName),
    equipment: inferBicepsEquipment(title),
    difficulty: inferBicepsDifficulty(title),
    description: `${title} в клиентской библиотеке для работы над бицепсом и контролем техники сгибаний.`,
    technique_steps: [
      "Займите устойчивое исходное положение",
      "Поднимите вес за счёт сгибания в локте без раскачки",
      "Медленно опустите вниз, сохраняя контроль амплитуды",
    ],
    tips: ["Не подключайте корпус", "Держите локти под контролем и не бросайте негативную фазу"],
    muscle_groups: inferBicepsMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function inferTricepsEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("ez-штанг") || lower.includes("штанг")) return "Штанга";
  if (lower.includes("гантел")) return "Гантели";
  if (lower.includes("блок") || lower.includes("кроссовер") || lower.includes("кабел")) return "Блок";
  if (lower.includes("смит")) return "Смит";
  if (lower.includes("брусь")) return "Брусья";
  return "Трицепс";
}

function inferTricepsDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("стоя") || lower.includes("сидя") || lower.includes("на верхнем блоке")) {
    return "Лёгкая";
  }
  if (lower.includes("узким хватом") || lower.includes("с весом") || lower.includes("французский")) {
    return "Сложная";
  }
  return "Средняя";
}

function inferTricepsMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("из-за головы") || lower.includes("над голов")) {
    return ["Трицепс", "Длинная головка трицепса", "Локтевая стабилизация"];
  }
  if (lower.includes("брусь") || lower.includes("отжим")) {
    return ["Трицепс", "Грудь", "Передняя дельта"];
  }
  return ["Трицепс", "Предплечья"];
}

function createAutoTricepsExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Трицепс",
    image_url: getPublicExerciseAssetPath("Triceps", fileName),
    equipment: inferTricepsEquipment(title),
    difficulty: inferTricepsDifficulty(title),
    description: `${title} в клиентской библиотеке для работы над трицепсом и контроля техники разгибаний.`,
    technique_steps: [
      "Займите устойчивое исходное положение и зафиксируйте корпус",
      "Выполните разгибание в локтевом суставе без лишней раскачки",
      "Вернитесь в стартовую точку медленно и под контролем",
    ],
    tips: ["Старайтесь не разводить локти без необходимости", "Не бросайте обратную фазу движения"],
    muscle_groups: inferTricepsMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function inferQuadricepsEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("штанг")) return "Штанга";
  if (lower.includes("гантел")) return "Гантели";
  if (lower.includes("смит")) return "Смит";
  if (lower.includes("тренаж")) return "Тренажёр";
  return "Ноги";
}

function inferQuadricepsDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("разгибание ног") || lower.includes("жим ногами") || lower.includes("рычажном тренажере")) {
    return "Лёгкая";
  }
  if (lower.includes("болгарские") || lower.includes("сплит") || lower.includes("в ходьбе")) {
    return "Сложная";
  }
  return "Средняя";
}

function inferQuadricepsMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("сумо")) return ["Квадрицепс", "Приводящие мышцы", "Ягодицы"];
  if (lower.includes("болгарские") || lower.includes("сплит") || lower.includes("выпады") || lower.includes("зашагивания")) {
    return ["Квадрицепс", "Ягодицы", "Бицепс бедра"];
  }
  if (lower.includes("жим ногами")) return ["Квадрицепс", "Ягодицы", "Бицепс бедра"];
  return ["Квадрицепс", "Ягодицы"];
}

function createAutoQuadricepsExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Квадрицепс",
    image_url: getPublicExerciseAssetPath("Quadriceps", fileName),
    equipment: inferQuadricepsEquipment(title),
    difficulty: inferQuadricepsDifficulty(title),
    description: `${title} в клиентской библиотеке для развития квадрицепсов и контроля техники приседаний, выпадов и жимов ногами.`,
    technique_steps: [
      "Подготовьте устойчивое исходное положение и соберите корпус",
      "Выполните движение в контролируемой амплитуде без рывка",
      "Вернитесь в старт, сохраняя давление на рабочую ногу или платформу",
    ],
    tips: ["Следите за направлением коленей", "Не теряйте контроль в нижней точке движения"],
    muscle_groups: inferQuadricepsMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function inferHamstringsEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("тяг")) return "Штанга";
  if (lower.includes("тренаж")) return "Тренажёр";
  return "Ноги";
}

function inferHamstringsDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("сидя") || lower.includes("лёжа") || lower.includes("лёжа")) {
    return "Лёгкая";
  }
  if (lower.includes("румынская")) {
    return "Сложная";
  }
  return "Средняя";
}

function inferHamstringsMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("румынская")) return ["Бицепс бедра", "Ягодицы", "Разгибатели спины"];
  return ["Бицепс бедра", "Икроножные", "Ягодицы"];
}

function createAutoHamstringsExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Бицепс бедра",
    image_url: getPublicExerciseAssetPath("Hamstrings", fileName),
    equipment: inferHamstringsEquipment(title),
    difficulty: inferHamstringsDifficulty(title),
    description: `${title} в клиентской библиотеке для развития задней поверхности бедра и контроля техники тяговых и сгибательных движений.`,
    technique_steps: [
      "Примите устойчивое исходное положение и зафиксируйте корпус",
      "Выполните движение в контролируемой амплитуде без рывка",
      "Вернитесь в стартовую точку медленно и под контролем",
    ],
    tips: ["Сохраняйте нейтральное положение спины", "Не ускоряйте обратную фазу"],
    muscle_groups: inferHamstringsMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function inferShouldersEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("штанг")) return "Штанга";
  if (lower.includes("гантел")) return "Гантели";
  if (lower.includes("смит")) return "Смит";
  if (lower.includes("тренаж")) return "Тренажёр";
  if (lower.includes("кроссовер") || lower.includes("канат")) return "Блок";
  return "Плечи";
}

function inferShouldersDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("в тренажере") || lower.includes("сидя")) {
    return "Лёгкая";
  }
  if (lower.includes("армейский") || lower.includes("тяга штанги к подбородку") || lower.includes("жим арнольда")) {
    return "Сложная";
  }
  return "Средняя";
}

function inferShouldersMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("обрат") || lower.includes("задн") || lower.includes("к лицу")) {
    return ["Задняя дельта", "Верх спины", "Трапеции"];
  }
  if (lower.includes("перед")) {
    return ["Передняя дельта", "Верх груди", "Трапеции"];
  }
  return ["Средняя дельта", "Передняя дельта", "Трапеции"];
}

function createAutoShouldersExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Плечи",
    image_url: getPublicExerciseAssetPath("Shoulders", fileName),
    equipment: inferShouldersEquipment(title),
    difficulty: inferShouldersDifficulty(title),
    description: `${title} в клиентской библиотеке для развития дельтовидных мышц и контроля техники жимов, махов и тяг.`,
    technique_steps: [
      "Примите устойчивое исходное положение и соберите корпус",
      "Выполните движение без рывка и чрезмерного подключения корпуса",
      "Вернитесь в стартовую точку медленно и под контролем",
    ],
    tips: ["Следите за положением плеч и шеи", "Не ускоряйте негативную фазу движения"],
    muscle_groups: inferShouldersMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function inferHipsEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("гантел")) return "Гантели";
  if (lower.includes("тренаж")) return "Тренажёр";
  if (lower.includes("тяг")) return "Штанга";
  return "Ягодицы";
}

function inferHipsDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("сидя") || lower.includes("в тренажере")) {
    return "Лёгкая";
  }
  if (lower.includes("румынская тяга")) {
    return "Сложная";
  }
  return "Средняя";
}

function inferHipsMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("отведение")) return ["Средняя ягодичная", "Малая ягодичная", "Внешняя поверхность бедра"];
  if (lower.includes("сведение")) return ["Приводящие мышцы", "Внутренняя поверхность бедра", "Ягодицы"];
  if (lower.includes("мостик")) return ["Ягодицы", "Бицепс бедра", "Кор"];
  if (lower.includes("румынская")) return ["Ягодицы", "Бицепс бедра", "Разгибатели спины"];
  return ["Ягодицы", "Бицепс бедра"];
}

function createAutoHipsExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Ягодицы",
    image_url: getPublicExerciseAssetPath("Hips", fileName),
    equipment: inferHipsEquipment(title),
    difficulty: inferHipsDifficulty(title),
    description: `${title} в клиентской библиотеке для развития ягодичных мышц, задней цепи и контроля техники тазового движения.`,
    technique_steps: [
      "Займите устойчивое исходное положение и соберите корпус",
      "Выполните движение без рывка, сохраняя контроль над тазом",
      "Вернитесь в стартовую точку медленно и под контролем",
    ],
    tips: ["Следите за нейтральным положением спины", "Не теряйте контроль в пиковом сокращении"],
    muscle_groups: inferHipsMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function inferWaistEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("колес") || lower.includes("ролик")) return "Ролик";
  if (lower.includes("в висе")) return "Турник";
  if (lower.includes("блок")) return "Блок";
  if (lower.includes("скамье")) return "Скамья";
  return "Собственный вес";
}

function inferWaistDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("планка") || lower.includes("касание пяток") || lower.includes("на полу")) {
    return "Лёгкая";
  }
  if (lower.includes("колес") || lower.includes("ролик") || lower.includes("в висе")) {
    return "Сложная";
  }
  return "Средняя";
}

function inferWaistMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("бок")) return ["Косые мышцы живота", "Пресс", "Кор"];
  if (lower.includes("планка")) return ["Пресс", "Поперечная мышца живота", "Кор"];
  if (lower.includes("твист")) return ["Косые мышцы живота", "Пресс", "Кор"];
  if (lower.includes("в висе") || lower.includes("подъем ног")) return ["Нижний пресс", "Сгибатели бедра", "Пресс"];
  return ["Пресс", "Кор", "Косые мышцы живота"];
}

function createAutoWaistExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Пресс",
    image_url: getPublicExerciseAssetPath("Waist", fileName),
    equipment: inferWaistEquipment(title),
    difficulty: inferWaistDifficulty(title),
    description: `${title} в клиентской библиотеке для развития мышц кора, пресса и контроля положения корпуса.`,
    technique_steps: [
      "Примите устойчивое исходное положение и зафиксируйте корпус",
      "Выполните движение без рывка, сохраняя напряжение в мышцах живота",
      "Вернитесь в стартовую точку медленно и под контролем",
    ],
    tips: ["Не теряйте нейтральное положение поясницы", "Работайте за счёт мышц кора, а не инерции"],
    muscle_groups: inferWaistMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function inferCalvesEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("смит")) return "Смит";
  if (lower.includes("тренаж")) return "Тренажёр";
  return "Собственный вес";
}

function inferCalvesDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("сидя") || lower.includes("в тренажере")) {
    return "Лёгкая";
  }
  if (lower.includes("стоя") && !lower.includes("тренаж")) {
    return "Средняя";
  }
  return "Средняя";
}

function inferCalvesMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("сидя")) return ["Икры", "Камбаловидная мышца", "Голеностоп"];
  return ["Икры", "Икроножная мышца", "Голеностоп"];
}

function createAutoCalvesExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Икры",
    image_url: getPublicExerciseAssetPath("Calves", fileName),
    equipment: inferCalvesEquipment(title),
    difficulty: inferCalvesDifficulty(title),
    description: `${title} в клиентской библиотеке для развития икроножных мышц и контроля амплитуды в подъёмах на носки.`,
    technique_steps: [
      "Примите устойчивое исходное положение и упритесь передней частью стопы",
      "Поднимитесь на носки в полной амплитуде без рывка",
      "Медленно опуститесь вниз, сохраняя контроль движения",
    ],
    tips: ["Не сокращайте амплитуду движения", "Делайте паузу в верхней точке при возможности"],
    muscle_groups: inferCalvesMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function inferNeckEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("тренаж")) return "Тренажёр";
  return "Собственный вес";
}

function inferNeckDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("лежа") || lower.includes("сидя")) return "Лёгкая";
  if (lower.includes("мостик")) return "Сложная";
  return "Средняя";
}

function inferNeckMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("мостик")) return ["Шея", "Трапеции", "Разгибатели спины"];
  if (lower.includes("сгибание")) return ["Шея", "Глубокие сгибатели шеи", "Трапеции"];
  return ["Шея", "Трапеции", "Разгибатели шеи"];
}

function createAutoNeckExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Шея",
    image_url: getPublicExerciseAssetPath("Neck", fileName),
    equipment: inferNeckEquipment(title),
    difficulty: inferNeckDifficulty(title),
    description: `${title} в клиентской библиотеке для укрепления мышц шеи и контроля амплитуды в сгибаниях и разгибаниях.`,
    technique_steps: [
      "Примите устойчивое исходное положение и расслабьте плечи",
      "Выполните движение шеи плавно, без рывков и чрезмерной амплитуды",
      "Вернитесь в стартовую позицию под контролем",
    ],
    tips: ["Избегайте резких движений головой", "Сохраняйте комфортную амплитуду без боли"],
    muscle_groups: inferNeckMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function inferForearmsEquipment(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("кабел")) return "Блок";
  if (lower.includes("скам")) return "Скамья";
  return "Собственный вес";
}

function inferForearmsDifficulty(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("одной руко")) return "Лёгкая";
  if (lower.includes("обратным хватом")) return "Сложная";
  return "Средняя";
}

function inferForearmsMuscleGroups(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("обратным хватом")) return ["Предплечья", "Плечелучевая мышца", "Бицепс"];
  return ["Предплечья", "Сгибатели запястья", "Плечелучевая мышца"];
}

function createAutoForearmsExercise(
  id: string,
  fileName: string,
  title = normalizeExerciseFileTitle(fileName)
): ExerciseLibraryRow {
  return {
    id,
    title,
    muscle_group: "Предплечья",
    image_url: getPublicExerciseAssetPath("Forearms", fileName),
    equipment: inferForearmsEquipment(title),
    difficulty: inferForearmsDifficulty(title),
    description: `${title} в клиентской библиотеке для укрепления предплечий и улучшения силы хвата.`,
    technique_steps: [
      "Примите устойчивое исходное положение и зафиксируйте предплечья",
      "Выполните сгибание или удержание без рывка",
      "Медленно вернитесь в стартовую точку под контролем",
    ],
    tips: ["Не раскачивайте корпус", "Работайте в комфортной амплитуде запястий"],
    muscle_groups: inferForearmsMuscleGroups(title),
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

const chestExercises: ExerciseLibraryRow[] = [
  {
    id: "demo-ex-chest-1",
    title: "Жим штанги лежа",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Жим штанги лежа.webp"),
    equipment: "Штанга",
    difficulty: "Средняя",
    description: "Базовое силовое упражнение на грудные мышцы с акцентом на стабильную технику и контроль лопаток.",
    technique_steps: ["Лягте на скамью и сведите лопатки", "Опустите штангу к середине груди", "Выжмите вверх по контролируемой траектории"],
    tips: ["Не отрывайте таз от скамьи", "Держите стопы плотно на полу"],
    muscle_groups: ["Грудь", "Трицепс", "Передняя дельта"],
    video_url: "https://www.youtube.com/embed/rT7DgCr-3pg",
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-2",
    title: "Жим гантелей лежа",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Жим гантелей лежа.webp"),
    equipment: "Гантели",
    difficulty: "Средняя",
    description: "Вариант жима с большей амплитудой и независимой работой рук.",
    technique_steps: ["Поднимите гантели над грудью", "Опустите локти до комфортной глубины", "Выжмите гантели вверх без удара друг о друга"],
    tips: ["Сохраняйте лёгкий прогиб", "Не теряйте контроль в нижней точке"],
    muscle_groups: ["Грудь", "Трицепс", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-3",
    title: "Жим лежа на наклонной скамье",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Жим лежа на наклонной скамье.webp"),
    equipment: "Штанга",
    difficulty: "Средняя",
    description: "Смещение акцента на верхнюю часть груди при классической жимовой механике.",
    technique_steps: ["Установите спинку под умеренным углом", "Опустите штангу к верхней части груди", "Выжмите вверх без потери положения плеч"],
    tips: ["Не делайте угол слишком высоким", "Держите запястья над локтями"],
    muscle_groups: ["Верх груди", "Трицепс", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-4",
    title: "Жим гантелей на наклонной скамье",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Жим гантелей на наклонной скамье.webp"),
    equipment: "Гантели",
    difficulty: "Средняя",
    description: "Контрольный жим для верхней части груди с независимой работой каждой руки.",
    technique_steps: ["Поднимите гантели в исходное положение", "Опустите локти под контролем", "Выжмите вверх по дуге"],
    tips: ["Сохраняйте грудь раскрытой", "Не бросайте гантели вниз"],
    muscle_groups: ["Верх груди", "Трицепс", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-5",
    title: "Жим штанги лежа в смите",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Жим штанги лежа в смите.webp"),
    equipment: "Смит",
    difficulty: "Лёгкая",
    description: "Более стабильный жим для работы с техникой и добивочных подходов.",
    technique_steps: ["Настройте высоту грифа", "Опустите штангу к груди по фиксированной траектории", "Выжмите вверх без провала плеч"],
    tips: ["Не ставьте скамью слишком далеко", "Следите за положением локтей"],
    muscle_groups: ["Грудь", "Трицепс", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-6",
    title: "Жим гантелей с «молотковым» хватом лежа",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Жим хаммера лежа.webp"),
    equipment: "Гантели",
    difficulty: "Средняя",
    description: "Вариант жима гантелей лёжа с нейтральным хватом, который помогает мягче нагрузить плечи и хорошо прочувствовать грудные мышцы.",
    technique_steps: [
      "Лягте на горизонтальную скамью, плотно упритесь стопами в пол и удерживайте лёгкий прогиб в грудном отделе.",
      "Поднимите гантели над грудью и держите ладони обращёнными друг к другу на всём протяжении движения.",
      "Опускайте гантели по контролируемой траектории к боковым линиям груди, не разводя локти слишком широко.",
      "Выжмите гантели вверх, сохраняя нейтральный хват и стабильное положение лопаток.",
      "В верхней точке не сталкивайте гантели и не теряйте напряжение в грудных мышцах.",
    ],
    tips: [
      "Сведите лопатки и не подавайте плечи вперёд во время жима.",
      "Держите локти под контролем и не опускайте гантели слишком низко через боль в плечах.",
      "Работайте плавно: нейтральный хват особенно хорошо раскрывается при спокойном темпе.",
    ],
    muscle_groups: ["Грудь", "Трицепс", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-7",
    title: "Жим в тренажере",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Жим в тренажере.webp"),
    equipment: "Тренажёр",
    difficulty: "Лёгкая",
    description: "Контролируемый жим для объёмной работы на грудь.",
    technique_steps: ["Подберите высоту сиденья", "Выжмите рукояти перед собой", "Медленно вернитесь обратно"],
    tips: ["Не выталкивайте плечи вперёд", "Контролируйте темп опускания"],
    muscle_groups: ["Грудь", "Трицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-8",
    title: "Жим в тренажере под углом",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Жим в тренажере под углом.webp"),
    equipment: "Тренажёр",
    difficulty: "Лёгкая",
    description: "Жимовая работа на верх груди в более стабильной траектории.",
    technique_steps: ["Сядьте с упором спины", "Выжмите рукояти по диагонали вверх", "Вернитесь без потери контроля"],
    tips: ["Держите лопатки собранными", "Не разгибайте локти до щелчка"],
    muscle_groups: ["Верх груди", "Передняя дельта", "Трицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-9",
    title: "Бабочка",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Бабочка.webp"),
    equipment: "Тренажёр",
    difficulty: "Лёгкая",
    description: "Изолированное сведение рук для акцента на сокращении грудных мышц.",
    technique_steps: ["Установите локти на опоры", "Сведите руки перед собой", "Верните их назад без провала плеч"],
    tips: ["Не толкайте руками", "Работайте через грудь"],
    muscle_groups: ["Грудь"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-10",
    title: "Сведение рук в кроссовере",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Сведение рук в кроссовере.webp"),
    equipment: "Блок",
    difficulty: "Средняя",
    description: "Классическое сведение рук в кроссовере с постоянным натяжением.",
    technique_steps: ["Возьмите рукояти верхних блоков", "Сведите руки перед корпусом", "Вернитесь назад с контролем"],
    tips: ["Сохраняйте лёгкий наклон корпуса", "Не выпрямляйте локти полностью"],
    muscle_groups: ["Грудь", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-11",
    title: "Сведение рук в кроссовере на среднюю часть груди",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Сведение рук в кроссовере на среднюю часть груди.webp"),
    equipment: "Блок",
    difficulty: "Средняя",
    description: "Вариация кроссовера с акцентом на среднюю часть грудных мышц.",
    technique_steps: ["Выставьте блоки на среднюю высоту", "Сведите руки перед грудью", "Вернитесь назад без рывка"],
    tips: ["Не теряйте угол в локтях", "Фокусируйтесь на сокращении груди"],
    muscle_groups: ["Грудь"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-12",
    title: "Сведение нижних блоков",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Сведение нижних блоков.webp"),
    equipment: "Блок",
    difficulty: "Средняя",
    description: "Сведение снизу вверх с акцентом на верх груди.",
    technique_steps: ["Возьмите нижние рукояти", "Поднимайте руки по дуге вверх", "Медленно вернитесь вниз"],
    tips: ["Не закидывайте плечи", "Двигайтесь плавно по дуге"],
    muscle_groups: ["Верх груди", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-13",
    title: "Разведение гантелей лежа",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Разведение гантелей лежа.webp"),
    equipment: "Гантели",
    difficulty: "Средняя",
    description: "Изоляция груди через разведение рук на горизонтальной скамье.",
    technique_steps: ["Поднимите гантели над грудью", "Опустите руки по широкой дуге", "Сведите гантели обратно"],
    tips: ["Сохраняйте мягкий сгиб локтей", "Не опускайте гантели слишком низко"],
    muscle_groups: ["Грудь", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-14",
    title: "Разведение гантелей на наклонной скамье",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Разведение гантелей на наклонной скамье.webp"),
    equipment: "Гантели",
    difficulty: "Средняя",
    description: "Разведения под наклоном с акцентом на верх груди.",
    technique_steps: ["Сядьте на наклонную скамью", "Опустите гантели в стороны по дуге", "Сведите их над верхней частью груди"],
    tips: ["Не выпрямляйте локти", "Сохраняйте контроль в нижней точке"],
    muscle_groups: ["Верх груди", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-15",
    title: "Жим гантелей со сжатием",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Жим гантелей со сжатием.webp"),
    equipment: "Гантели",
    difficulty: "Средняя",
    description: "Жим с постоянным сведением гантелей для усиления сокращения груди.",
    technique_steps: ["Сведите гантели вместе", "Выжмите вверх, не теряя давления", "Медленно опустите вниз"],
    tips: ["Сохраняйте давление между гантелями", "Не ускоряйте негативную фазу"],
    muscle_groups: ["Грудь", "Трицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-16",
    title: "Отжимания",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Отжимания.webp"),
    equipment: "Собственный вес",
    difficulty: "Лёгкая",
    description: "Универсальное упражнение на грудь, трицепс и переднюю дельту.",
    technique_steps: ["Примите упор лёжа", "Опуститесь вниз, сохраняя линию корпуса", "Выжмите себя вверх"],
    tips: ["Не провисайте в пояснице", "Локти ведите под контролем"],
    muscle_groups: ["Грудь", "Трицепс", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-17",
    title: "Отжимания от скамьи",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Отжимания от скамьи.webp"),
    equipment: "Скамья",
    difficulty: "Лёгкая",
    description: "Упрощённый вариант отжиманий для контроля техники и объёма.",
    technique_steps: ["Поставьте руки на скамью", "Опуститесь к опоре", "Вернитесь вверх в ровной линии"],
    tips: ["Держите корпус жёстким", "Не разводите локти слишком широко"],
    muscle_groups: ["Грудь", "Трицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-18",
    title: "Обратные отжимания от скамьи",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Обратные отжимания от скамьи.webp"),
    equipment: "Скамья",
    difficulty: "Средняя",
    description: "Отжимания с опорой сзади с большой нагрузкой на трицепс и передний пояс.",
    technique_steps: ["Поставьте руки на край скамьи", "Опуститесь вниз, сгибая локти", "Выжмите себя вверх"],
    tips: ["Не опускайтесь глубже комфорта плеч", "Держите локти ближе к корпусу"],
    muscle_groups: ["Трицепс", "Нижняя часть груди", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-19",
    title: "Отжимания на брусьях",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Отжимания на брусьях.webp"),
    equipment: "Брусья",
    difficulty: "Сложная",
    description: "Силовая вариация с акцентом на грудь и трицепс.",
    technique_steps: ["Поднимитесь в упор на брусьях", "Слегка наклонитесь вперёд и опуститесь вниз", "Выжмите себя обратно"],
    tips: ["Не раскачивайтесь", "Контролируйте глубину"],
    muscle_groups: ["Грудь", "Трицепс", "Передняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-chest-20",
    title: "Отжимания на брусьях в гравитроне",
    muscle_group: "Грудь",
    image_url: getPublicExerciseAssetPath("Chest", "Отжимания на брусьях в гравитроне.webp"),
    equipment: "Гравитрон",
    difficulty: "Средняя",
    description: "Облегчённый вариант отжиманий на брусьях с поддержкой веса.",
    technique_steps: ["Встаньте на платформу гравитрона", "Опуститесь в контролируемой амплитуде", "Выжмите себя вверх"],
    tips: ["Подберите помощь под текущий уровень", "Сохраняйте лёгкий наклон вперёд"],
    muscle_groups: ["Грудь", "Трицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
];

const backExercises: ExerciseLibraryRow[] = [
  {
    id: "demo-ex-back-1",
    title: "Австралийские подтягивания",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "Австралийские подтягивания.webp"),
    equipment: "Собственный вес",
    difficulty: "Средняя",
    description: "Горизонтальная тяга собственным весом для широчайших и верхней части спины.",
    technique_steps: ["Возьмитесь за низкую перекладину", "Подтяните грудь к опоре", "Медленно опуститесь вниз"],
    tips: ["Держите корпус прямым", "Тянитесь локтями назад"],
    muscle_groups: ["Широчайшие", "Ромбовидные", "Бицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-back-2",
    title: "Вертикальная рычажная тяга",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "Вертикальная рычажная тяга.webp"),
    equipment: "Тренажёр",
    difficulty: "Лёгкая",
    description: "Тяга сверху в рычажном тренажёре для широчайших и верхней части спины.",
    technique_steps: ["Сядьте в тренажёр", "Потяните рукояти вниз к корпусу", "Вернитесь в исходное положение"],
    tips: ["Не раскачивайтесь", "Сохраняйте грудь раскрытой"],
    muscle_groups: ["Широчайшие", "Бицепс", "Верх спины"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-back-3",
    title: "Рычажная тяга сверху",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "Рычажная тяга сверху.webp"),
    equipment: "Тренажёр",
    difficulty: "Лёгкая",
    description: "Одно из базовых тяг в тренажёре для проработки широчайших.",
    technique_steps: ["Возьмитесь за рукояти", "Тяните их вниз и к себе", "Контролируйте обратную фазу"],
    tips: ["Не поднимайте плечи к ушам", "Двигайтесь через локоть"],
    muscle_groups: ["Широчайшие", "Круглые мышцы", "Бицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-back-4",
    title: "Рычажная тяга верхнего блока обратным хватом",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "Рычажная тяга верхнего блока обратным хватом.webp"),
    equipment: "Тренажёр",
    difficulty: "Средняя",
    description: "Тяга с обратным хватом для широчайших и нижнего угла лопатки.",
    technique_steps: ["Возьмитесь обратным хватом", "Потяните рукояти к себе", "Медленно вернитесь обратно"],
    tips: ["Не переразгибайте поясницу", "Держите локти ближе к корпусу"],
    muscle_groups: ["Широчайшие", "Бицепс", "Нижняя часть трапеции"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-back-5",
    title: "Рычажная тяга сидя",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "Рычажная тяга сидя.webp"),
    equipment: "Тренажёр",
    difficulty: "Лёгкая",
    description: "Горизонтальная тяга сидя для средней части спины и контроля лопаток.",
    technique_steps: ["Сядьте устойчиво", "Потяните рукояти к поясу", "Плавно вернитесь вперёд"],
    tips: ["Не округляйте плечи", "Сводите лопатки в пиковой точке"],
    muscle_groups: ["Средняя часть спины", "Ромбовидные", "Бицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-back-6",
    title: "Рычажная попеременная тяга узким хватом сидя",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "Рычажная попеременная тяга узким хватом сидя.webp"),
    equipment: "Тренажёр",
    difficulty: "Средняя",
    description: "Попеременная тяга для контроля амплитуды и симметрии в работе спины.",
    technique_steps: ["Зафиксируйте корпус", "Тяните рукоять одной рукой", "Верните и смените сторону"],
    tips: ["Не разворачивайте корпус", "Двигайтесь плавно"],
    muscle_groups: ["Широчайшие", "Ромбовидные", "Задняя дельта"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-back-7",
    title: "Низкая горизонтальная тяга сидя",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "Низкая горизонтальная тяга сидя.webp"),
    equipment: "Блок",
    difficulty: "Лёгкая",
    description: "Сидячая тяга к поясу для средней части спины и широчайших.",
    technique_steps: ["Поставьте стопы на платформу", "Потяните рукоять к низу живота", "Медленно вернитесь назад"],
    tips: ["Не тяните за счёт корпуса", "Сохраняйте нейтральную спину"],
    muscle_groups: ["Широчайшие", "Средняя часть спины", "Бицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-back-8",
    title: "Горизонтальная тяга краб-рукоятью",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "Горизонтальная тяга краб-рукоятью.webp"),
    equipment: "Блок",
    difficulty: "Средняя",
    description: "Тяга с нейтральной рукоятью для плотной работы средней части спины.",
    technique_steps: ["Возьмитесь за рукоять", "Потяните к корпусу", "Вернитесь вперёд под контролем"],
    tips: ["Не зажимайте шею", "Сводите лопатки в конце"],
    muscle_groups: ["Средняя часть спины", "Ромбовидные", "Бицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-back-9",
    title: "Кабельная тяга одной рукой на коленях",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "Кабельная тяга одной рукой на коленях.webp"),
    equipment: "Блок",
    difficulty: "Средняя",
    description: "Односторонняя тяга сверху для широчайших с хорошим контролем траектории.",
    technique_steps: ["Встаньте на одно колено", "Потяните рукоять вниз к корпусу", "Медленно выпрямите руку"],
    tips: ["Стабилизируйте корпус", "Не уводите локоть в сторону"],
    muscle_groups: ["Широчайшие", "Круглые мышцы", "Бицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-back-10",
    title: "Становая тяга",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "Становая тяга.webp"),
    equipment: "Штанга",
    difficulty: "Сложная",
    description: "Базовое силовое упражнение на заднюю цепь, спину и ноги.",
    technique_steps: ["Подойдите к штанге", "Поднимите её за счёт разгибания ног и таза", "Опустите обратно под контролем"],
    tips: ["Держите спину нейтральной", "Штанга идёт вдоль ног"],
    muscle_groups: ["Разгибатели спины", "Ягодицы", "Бицепс бедра"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-back-11",
    title: "Рычажная тяга нижнего блока в тренажере",
    muscle_group: "Спина",
    image_url: getPublicExerciseAssetPath("Back", "рычажная тяга нижнего блока:в тренажере.webp"),
    equipment: "Тренажёр",
    difficulty: "Средняя",
    description: "Нижняя рычажная тяга для плотной работы спины в контролируемой траектории.",
    technique_steps: ["Сядьте устойчиво", "Тяните рукояти к поясу", "Медленно вернитесь в старт"],
    tips: ["Сохраняйте грудь открытой", "Не округляйте поясницу"],
    muscle_groups: ["Широчайшие", "Средняя часть спины", "Бицепс"],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  ...[
    "Гиперэкстензия под углом 45 градусов.webp",
    "Подтягивания в гравитроне.webp",
    "Подтягивания обратным хватом.webp",
    "Подтягивания с весом.webp",
    "Подтягивания с резинкой.webp",
    "Подтягивания широким хватом.webp",
    "Подтягивания.webp",
    "Тяга Т-грифа в наклоне с V-образной рукоятью.webp",
    "Тяга в наклоне.webp",
    "Тяга верхнего блока V-образной рукоятью.webp",
    "Тяга верхнего блока к груди.webp",
    "Тяга верхнего блока одной рукой справа.webp",
    "Тяга верхнего блока сидя обратным хватом.webp",
    "Тяга верхнего блока широким нейтральным хватом сидя.webp",
    "Тяга верхнего блока широким нейтральным хватом.webp",
    "Тяга верхнего блока широким хватом.webp",
    "Тяга верхнего блока.webp",
    "Тяга гантелей в наклоне с пронацией:супинацией.webp",
    "Тяга гантелей на наклонной скамье.webp",
    "Тяга гантели одной рукой в наклоне.webp",
    "Тяга горизонтального блока сидя с V-образной рукоятью.webp",
    "Тяга горизонтального блока широким хватом сидя.webp",
    "Тяга к поясу сидя с прямой спиной.webp",
    "Тяга каната стоя в наклоне.webp",
    "Тяга рычага Т-штанги лежа.webp",
    "Тяга рычага сидя узким хватом.webp",
    "Тяга штанги в наклоне широким хватом.webp",
    "Тяга штанги в наклоне.webp",
    "Шраги с гантелями.webp",
    "Шраги со штангой.webp",
  ].map((fileName, index) =>
    createAutoBackExercise(`demo-ex-back-auto-${index + 1}`, fileName)
  ),
];

const bicepsExercises: ExerciseLibraryRow[] = [
  ...[
    "Концентрированное сгибание рук.webp",
    "Одновременнное сгибания рук с гантелями (молотки).webp",
    "Подъем гантелей сидя.webp",
    "Подъем на бицепс в рычажном тренажере на скамье Скотта.webp",
    "Подъем штанги на бицепс.webp",
    "Поочередное сгибание рук на бицепс.webp",
    "Поочередное сгибания рук с гантелями (молотки).webp",
    "Поперечный молотковый подъем гантелей.webp",
    "Сгибание рук на бицепс в блоке.webp",
    "Сгибание рук на блоке .webp",
    "Сгибание рук над головой.webp",
    "Сгибания рук на бицепс.webp",
    "Сгибания рук на скамье Скотта с канатной рукоятью.webp",
    "Сгибания рук на скамье Скотта узким хватом.webp",
    "Сгибания рук с EZ-штангой на скамье Скотта.webp",
    "Сгибания рук с EZ-штангой.webp",
    "Сгибания рук с гантелями на наклонной скамье.webp",
    "Сгибания рук с гантелями-пауком.webp",
    "Сгибания рук со штангой-пауком.webp",
    "Сидячий молотковый подъем гантелей.webp",
    "Строгий подъем штанги на бицепс.webp",
  ].map((fileName, index) =>
    createAutoBicepsExercise(`demo-ex-biceps-auto-${index + 1}`, fileName)
  ),
];

const tricepsExercises: ExerciseLibraryRow[] = [
  ...[
    "Жим узким хватом в смите.webp",
    "Жим штанги лежа узким хватом.webp",
    "Одностороннее боковое разгибание рук на трицепс.webp",
    "Отведение кабеля в сторону.webp",
    "Отжимания на брусьях с весом.webp",
    "Отжимания на трицепс от скамьи.webp",
    "Отжимания узким хватом.webp",
    "Разгибание на трицепс одной рукой в кроссовере в наклоне.webp",
    "Разгибание на трицепс одной рукой в кроссовере с канатной рукоятью.webp",
    "Разгибание рук на блоке из-за головы:через верх.webp",
    "Разгибание рук на верхнем блоке с канатом из-за головы.webp",
    "Разгибание рук на верхнем блоке.webp",
    "Разгибание рук на трицепс из-за головы.webp",
    "Разгибание рук на трицепс лёжа.webp",
    "Разгибание рук на трицепс над головой на верхнем блоке.webp",
    "Разгибание рук на трицепс сидя.webp",
    "Разгибание рук на трицепс стоя.webp",
    "Разгибание рук с гантелью из-за головы сидя.webp",
    "Разгибание рук с канатами на верхнем блоке.webp",
    "Разгибание трицепса лежа с узким хватом на EZ-штанге за головой.webp",
    "Французский жим EZ-штангой.webp",
    "Французский жим штанги лёжа.webp",
  ].map((fileName, index) =>
    createAutoTricepsExercise(`demo-ex-triceps-auto-${index + 1}`, fileName)
  ),
];

const quadricepsExercises: ExerciseLibraryRow[] = [
  ...[
    "Болгарские сплит-приседания с гантелями.webp",
    "Выпады в тренажере Смита.webp",
    "Выпады с гантелями в ходьбе.webp",
    "Гакк-приседания в тренажере.webp",
    "Гоблет-приседания с гантелью.webp",
    "Жим ногами в тренажере под углом 45° с широкой постановкой.webp",
    "Жимом ногами сидя в рычажном тренажере.webp",
    "Зашагивания на платформу с гантелями.webp",
    "Полный присед в машине Смита.webp",
    "Приседания с гантелями на груди.webp",
    "Приседания со штангой в тренажёре Смита с опорой на стул.webp",
    "Приседания со штангой.webp",
    "Приседания сумо с гантелью.webp",
    "Разгибание ног на рычажном тренажере.webp",
    "Сплит-приседания на одной ноге в тренажере Смита.webp",
  ].map((fileName, index) =>
    createAutoQuadricepsExercise(`demo-ex-quadriceps-auto-${index + 1}`, fileName)
  ),
];

const hamstringsExercises: ExerciseLibraryRow[] = [
  ...[
    "Румынская тяга.webp",
    "Сгибание ног лёжа в тренажёре.webp",
    "Сгибание ног сидя в тренажере.webp",
  ].map((fileName, index) =>
    createAutoHamstringsExercise(`demo-ex-hamstrings-auto-${index + 1}`, fileName)
  ),
];

const shouldersExercises: ExerciseLibraryRow[] = [
  ...[
    "Армейский жим штанги стоя.webp",
    "Жим Арнольда.webp",
    "Жим вверх в тренажере.webp",
    "Жим на плечи сидя.webp",
    "Жим штанги сидя в тренажере Смита.webp",
    "Обратное разведение рук на рычажном тренажере сидя.webp",
    "Обратные разведения гантелей.webp",
    "Однорукая обратная разводка в кроссовере.webp",
    "Отведение руки в сторону в кроссовере.webp",
    "Подъем штанги перед собой сидя.webp",
    "Подъемы веса перед собой.webp",
    "Подъемы гантелей в стороны сидя.webp",
    "Подъемы гантелей перед собой.webp",
    "Подъемы рук в стороны.webp",
    "Разведение гантелей в наклоне.webp",
    "Сидячие махи гантелями с согнутыми руками.webp",
    "Тяга гантелей к задним дельтам в наклоне сидя.webp",
    "Тяга каната к лицу стоя : тяга на заднюю дельту.webp",
    "Тяга штанги к подбородку стоя.webp",
  ].map((fileName, index) =>
    createAutoShouldersExercise(`demo-ex-shoulders-auto-${index + 1}`, fileName)
  ),
];

const hipsExercises: ExerciseLibraryRow[] = [
  ...[
    "Отведение ног сидя в рычажном тренажере.webp",
    "Румынская тяга с гантелями .webp",
    "Румынская тяга.webp",
    "Сведение ног в тренажере сидя.webp",
    "Ягодичный мостик.webp",
  ].map((fileName, index) =>
    createAutoHipsExercise(`demo-ex-hips-auto-${index + 1}`, fileName)
  ),
];

const waistExercises: ExerciseLibraryRow[] = [
  ...[
    "Боковая планка.webp",
    "Выкатывание с колесом:роликом для пресса.webp",
    "Касание носков лежа.webp",
    "Лодочка.webp",
    "Ножницы.webp",
    "Обратное скручивание с выпрямлением ног.webp",
    "Планка.webp",
    "Подъём ног:коленей в висе.webp",
    "Подъем колена к локтю.webp",
    "Подъем ног с подъемом таза.webp",
    "Подъем ног сидя.webp",
    "Русский твист.webp",
    "Скручивания на блоке стоя.webp",
    "Скручивания на наклонной скамье.webp",
    "Скручивания на полу.webp",
    "Скручивания с касанием коленей.webp",
    "Чередующиеся касания пяток.webp",
  ].map((fileName, index) =>
    createAutoWaistExercise(`demo-ex-waist-auto-${index + 1}`, fileName)
  ),
];

const calvesExercises: ExerciseLibraryRow[] = [
  ...[
    "Жим икрами в тренажере для ног.webp",
    "Подъём на носки в рычажном тренажёре сидя.webp",
    "Подъем на носки стоя в рычажном тренажере.webp",
    "Подъем на носки стоя.webp",
    "Подъемы на носки в тренажере Смита.webp",
  ].map((fileName, index) =>
    createAutoCalvesExercise(`demo-ex-calves-auto-${index + 1}`, fileName)
  ),
];

const neckExercises: ExerciseLibraryRow[] = [
  ...[
    "Мостик на шее лежа на животе.webp",
    "Разгибание шеи в рычажном тренажере.webp",
    "Разгибание шеи лежа.webp",
    "Разгибание шеи сидя.webp",
    "Сгибание шеи лежа.webp",
  ].map((fileName, index) =>
    createAutoNeckExercise(`demo-ex-neck-auto-${index + 1}`, fileName)
  ),
];

const forearmsExercises: ExerciseLibraryRow[] = [
  ...[
    "Сгибание запястий двумя руками.webp",
    "Сгибание запястья одной рукой.webp",
    "Сгибания кистей на скамье.webp",
    "Сгибания рук с кабелем обратным хватом стоя.webp",
  ].map((fileName, index) =>
    createAutoForearmsExercise(`demo-ex-forearms-auto-${index + 1}`, fileName)
  ),
];

const demoMetrics: DemoDashboardMetric[] = [
  { label: "Активные клиенты", value: "18", helper: "13 персонально, 5 в поддержке" },
  { label: "Новые заявки", value: "4", helper: "За последние 7 дней" },
  { label: "Ждут ответа", value: "3", helper: "Нужен быстрый контакт" },
  { label: "Новые отчёты", value: "5", helper: "Поступили сегодня" },
  { label: "Обновить программу", value: "6", helper: "Клиенты дошли до следующего этапа" },
  { label: "Доход за месяц", value: "94 000 ₽", helper: "Персональное ведение + программы" },
];

const demoAttention: DemoAttentionItem[] = [
  {
    id: "a1",
    clientName: "Мария Волкова",
    label: "Прислала отчёт по тренировке",
    description: "Нужно ответить по технике приседаний и подтвердить следующий шаг.",
    priority: "Высокий",
    action: "Открыть клиента",
    secondaryAction: "Написать",
    eventTime: "20 минут назад",
  },
  {
    id: "a2",
    clientName: "Илья Крылов",
    label: "Не отвечает 3 дня",
    description: "Клиент выпал из контакта и может сорваться с ритма.",
    priority: "Высокий",
    action: "Написать",
    secondaryAction: "Открыть клиента",
    eventTime: "3 дня без ответа",
  },
  {
    id: "a3",
    clientName: "Елена Соколова",
    label: "Пора обновить программу",
    description: "Текущий цикл завершён, нужен новый тренировочный блок.",
    priority: "Высокий",
    action: "Обновить программу",
    secondaryAction: "Открыть клиента",
    eventTime: "Неделя 4 завершена",
  },
  {
    id: "a4",
    clientName: "Максим Орлов",
    label: "Давно не было новых замеров",
    description: "Без актуальных замеров сложнее корректировать питание и нагрузку.",
    priority: "Средний",
    action: "Запросить замеры",
    secondaryAction: "Открыть клиента",
    eventTime: "14 дней назад",
  },
  {
    id: "a5",
    clientName: "Ольга Кузнецова",
    label: "Купила программу",
    description: "Нужно подтвердить доступ и отправить стартовые инструкции.",
    priority: "Средний",
    action: "Подтвердить",
    secondaryAction: "Открыть продажу",
    eventTime: "Сегодня",
  },
];

const demoRoster: DemoRosterClient[] = [
  {
    id: "maria-volkova",
    name: "Мария Волкова",
    email: DEMO_CLIENT.email,
    goal: "Снижение веса",
    status: "Активна",
    currentWeight: "68.4 кг",
    lastActive: "20 минут назад",
    progress: "-1.2 кг за неделю",
    program: "Снижение веса 12 недель",
  },
  {
    id: "artem-smirnov",
    name: "Артём Смирнов",
    email: "artem.smirnov@example.com",
    goal: "Набор массы",
    status: "Требует внимания",
    currentWeight: "82.1 кг",
    lastActive: "4 дня назад",
    progress: "+0.4 кг за неделю",
    program: "Гипертрофия 4 дня",
  },
  {
    id: "irina-kozlova",
    name: "Ирина Козлова",
    email: "irina.kozlova@example.com",
    goal: "Сила и тонус",
    status: "Требует внимания",
    currentWeight: "59.8 кг",
    lastActive: "Сегодня",
    progress: "-0.3 кг за неделю",
    program: "Сила и тонус",
  },
  {
    id: "dmitry-lebedev",
    name: "Дмитрий Лебедев",
    email: "dmitry.lebedev@example.com",
    goal: "Поддержание формы",
    status: "Активна",
    currentWeight: "76.0 кг",
    lastActive: "2 дня назад",
    progress: "Без изменений",
    program: "Форма 3x45",
  },
  {
    id: "egor-nikitin",
    name: "Егор Никитин",
    email: "egor.nikitin@example.com",
    goal: "Рекомпозиция",
    status: "Нет программы",
    currentWeight: "89.3 кг",
    lastActive: "Сегодня",
    progress: "Стартовая анкета заполнена",
    program: "Не назначена",
  },
  {
    id: "ekaterina-morozova",
    name: "Екатерина Морозова",
    email: "ekaterina.morozova@example.com",
    goal: "Гипертрофия",
    status: "Требует внимания",
    currentWeight: "64.7 кг",
    lastActive: "10 дней назад",
    progress: "+0.2 кг за неделю",
    program: "Гипертрофия 5 дней",
  },
  {
    id: "anna-tarasova",
    name: "Анна Тарасова",
    email: "anna.tarasova@example.com",
    goal: "Возврат после паузы",
    status: "На паузе",
    currentWeight: "71.2 кг",
    lastActive: "6 дней назад",
    progress: "-0.1 кг за неделю",
    program: "Возврат 2x30",
  },
];

const demoPrograms: DemoProgram[] = [
  {
    id: "demo-program-1",
    title: "Снижение веса 6 недель",
    weeks: 6,
    price: 4900,
    status: "В продаже",
    dayOptions: [
      { id: "dw1d1", weekLabel: "Неделя 1", label: "День 1 — Ноги и core" },
      { id: "dw1d2", weekLabel: "Неделя 1", label: "День 2 — Верх тела" },
      { id: "dw1d3", weekLabel: "Неделя 1", label: "День 3 — Круговая" },
    ],
  },
  {
    id: "demo-program-2",
    title: "Масса: базовый цикл",
    weeks: 8,
    price: 6900,
    status: "Персонально",
    dayOptions: [
      { id: "dw2d1", weekLabel: "Неделя 1", label: "День 1 — Грудь и плечи" },
      { id: "dw2d2", weekLabel: "Неделя 1", label: "День 2 — Спина" },
      { id: "dw2d3", weekLabel: "Неделя 1", label: "День 3 — Ноги" },
    ],
  },
  {
    id: "demo-program-3",
    title: "Функциональный блок",
    weeks: 4,
    price: 0,
    status: "Черновик",
    dayOptions: [
      { id: "dw3d1", weekLabel: "Неделя 1", label: "День 1 — Full body" },
      { id: "dw3d2", weekLabel: "Неделя 1", label: "День 2 — Мобильность" },
    ],
  },
];

const demoExercises: ExerciseLibraryRow[] = [
  ...chestExercises,
  ...backExercises,
  ...bicepsExercises,
  ...tricepsExercises,
  ...quadricepsExercises,
  ...hamstringsExercises,
  ...shouldersExercises,
  ...hipsExercises,
  ...waistExercises,
  ...calvesExercises,
  ...neckExercises,
  ...forearmsExercises,
  {
    id: "demo-ex-system-2",
    title: "Тяга вертикального блока",
    muscle_group: "Спина",
    image_url: null,
    equipment: "Блок",
    difficulty: "Лёгкая",
    description: "Упражнение для широчайших и верхней части спины.",
    technique_steps: ["Возьмитесь за рукоять", "Тяните к верхней части груди", "Контролируйте обратную фазу"],
    tips: ["Не раскачивайтесь", "Держите грудь раскрытой"],
    muscle_groups: ["Широчайшие", "Бицепс", "Верх спины"],
    video_url: "https://www.youtube.com/embed/CAwf7n6Luuc",
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-system-3",
    title: "Приседания со штангой",
    muscle_group: "Ноги",
    image_url: null,
    equipment: "Штанга",
    difficulty: "Сложная",
    description: "Силовое упражнение на ноги и ягодицы.",
    technique_steps: ["Установите штангу на трапеции", "Сядьте вниз до параллели", "Встаньте через пятку"],
    tips: ["Колени направляйте по носкам", "Сохраняйте нейтральную спину"],
    muscle_groups: ["Квадрицепс", "Ягодицы", "Бицепс бедра"],
    video_url: "https://www.youtube.com/embed/ultWZbUMPL8",
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-system-4",
    title: "Жим гантелей сидя",
    muscle_group: "Плечи",
    image_url: null,
    equipment: "Гантели",
    difficulty: "Средняя",
    description: "Базовое упражнение на плечи с хорошим контролем амплитуды.",
    technique_steps: ["Сядьте с опорой спины", "Выжмите гантели вверх", "Опустите до уровня ушей"],
    tips: ["Не запрокидывайте голову", "Контролируйте локти"],
    muscle_groups: ["Передняя дельта", "Средняя дельта", "Трицепс"],
    video_url: "https://www.youtube.com/embed/qEwKCR5JCog",
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-system-5",
    title: "Сгибание рук с гантелями",
    muscle_group: "Руки",
    image_url: null,
    equipment: "Гантели",
    difficulty: "Лёгкая",
    description: "Изолированная работа на бицепс.",
    technique_steps: ["Возьмите гантели нейтральным хватом", "Поднимите к плечам", "Опустите без рывка"],
    tips: ["Не подключайте корпус", "Сохраняйте локти у корпуса"],
    muscle_groups: ["Бицепс", "Предплечья"],
    video_url: "https://www.youtube.com/embed/ykJmrZ5v0Oo",
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-system-6",
    title: "Планка",
    muscle_group: "Core",
    image_url: null,
    equipment: "Собственный вес",
    difficulty: "Лёгкая",
    description: "Статическое упражнение на мышцы кора.",
    technique_steps: ["Встаньте в упор на предплечья", "Подтяните таз", "Держите линию корпуса"],
    tips: ["Не провисайте в пояснице", "Дышите спокойно"],
    muscle_groups: ["Пресс", "Поперечная мышца живота", "Ягодицы"],
    video_url: "https://www.youtube.com/embed/pSHjTRCQxIw",
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-mine-1",
    title: "Ягодичный мост с паузой",
    muscle_group: "Ноги",
    image_url: null,
    equipment: "Штанга",
    difficulty: "Средняя",
    description: "Вариант ягодичного моста с удержанием в пиковой точке.",
    technique_steps: ["Установите штангу на таз", "Поднимите таз вверх", "Задержитесь на 2 секунды"],
    tips: ["Подбородок слегка к груди", "Сжимайте ягодицы вверху"],
    muscle_groups: ["Ягодицы", "Бицепс бедра"],
    video_url: null,
    is_system: false,
    owner_user_id: DEMO_TRAINER.id,
    source_exercise_id: "demo-ex-system-3",
    created_at: null,
    updated_at: null,
  },
  {
    id: "demo-ex-mine-2",
    title: "Тяга гантели в упоре",
    muscle_group: "Спина",
    image_url: null,
    equipment: "Гантель",
    difficulty: "Средняя",
    description: "Односторонняя тяга для контроля лопатки и центра корпуса.",
    technique_steps: ["Упритесь рукой в скамью", "Тяните локоть вверх", "Опустите без провала плеча"],
    tips: ["Не разворачивайте корпус", "Двигайтесь через локоть"],
    muscle_groups: ["Широчайшие", "Ромбовидные", "Задняя дельта"],
    video_url: null,
    is_system: false,
    owner_user_id: DEMO_TRAINER.id,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  },
];

export function getDemoDashboardMetrics() {
  return clone(demoMetrics);
}

export function getDemoAttentionItems() {
  return clone(demoAttention);
}

export function getDemoRosterClients() {
  return clone(demoRoster);
}

export function getDemoPrograms() {
  return clone(demoPrograms);
}

export function getDemoProgramDays(programId: string) {
  return clone(demoPrograms.find((program) => program.id === programId)?.dayOptions ?? []);
}

export function getDemoLibraryExercises() {
  return clone(demoExercises);
}

export function getDemoTrainerSummary() {
  return {
    trainer: {
      id: DEMO_TRAINER.id,
      fullName: DEMO_TRAINER.fullName,
      displayName: "Romanov Coaching",
      teamLogoUrl: null,
      slug: "romanov-coach",
      publicLink: "/t/romanov-coach",
    },
    metrics: getDemoDashboardMetrics(),
    attention: getDemoAttentionItems(),
    clients: getDemoRosterClients(),
    analytics: [
      { label: "Активность клиентов", value: "82%", helper: "Тренируются по плану" },
      { label: "Продажи программ", value: "12", helper: "За текущий месяц" },
      { label: "Средний чек", value: "5 200 ₽", helper: "По последним оплатам" },
    ],
    recentSales: [
      { id: "sale-1", title: "Снижение веса 6 недель", amount: "4 900 ₽", date: "Сегодня" },
      { id: "sale-2", title: "Масса: базовый цикл", amount: "6 900 ₽", date: "Вчера" },
      { id: "sale-3", title: "Консультация", amount: "3 000 ₽", date: "22 апр" },
    ],
  };
}

export function getDemoClientSummary() {
  return {
    client: {
      id: DEMO_CLIENT.id,
      fullName: DEMO_CLIENT.fullName,
      greeting: "Добрый вечер",
      currentWeight: "68.4 кг",
      targetWeight: "63.0 кг",
      goal: "Снижение веса",
      weekLabel: "3 неделя программы",
      adherence: "84%",
      water: "1.9 л",
    },
    trainer: {
      name: DEMO_TRAINER.fullName,
      displayName: "Romanov Coaching",
      telegramLink: "https://t.me/demo_trainer",
    },
    todayWorkout: {
      name: "Ноги и core",
      duration: "48 мин",
      status: "В процессе",
      focus: "Акцент на технику приседаний и стабильный темп в нижней точке.",
      exercises: [
        { id: "cw1", title: "Приседания со штангой", detail: "4 × 8" },
        { id: "cw2", title: "Ягодичный мост с паузой", detail: "4 × 10" },
        { id: "cw3", title: "Планка", detail: "3 × 45 сек" },
      ],
    },
    activity: {
      week: [
        { label: "Пн", value: 55 },
        { label: "Вт", value: 72 },
        { label: "Ср", value: 64 },
        { label: "Чт", value: 83 },
        { label: "Пт", value: 48 },
        { label: "Сб", value: 91 },
        { label: "Вс", value: 68 },
      ],
      month: [
        { label: "1", value: 34 },
        { label: "2", value: 61 },
        { label: "3", value: 48 },
        { label: "4", value: 76 },
        { label: "5", value: 58 },
        { label: "6", value: 84 },
        { label: "7", value: 69 },
        { label: "8", value: 53 },
      ],
    },
    overview: {
      completion: 84,
      workoutsWeek: "3 из 4",
      workoutsMonth: "11",
      weightDelta: "-1.2 кг",
      recovery: "7.8/10",
    },
    focusCards: [
      {
        id: "achievement-1",
        title: "6 тренировок подряд",
        target: "Без пропусков по плану",
        status: "Лучший ритм за месяц",
      },
      {
        id: "achievement-2",
        title: "Жим ногами +5 кг",
        target: "Новый силовой рекорд",
        status: "Прогресс этой недели",
      },
      {
        id: "achievement-3",
        title: "Неделя без пропусков",
        target: "3 из 3 тренировок закрыты",
        status: "Можно повторить на этой неделе",
      },
    ],
    progress: [
      { label: "Текущий вес", value: "68.4 кг", helper: "-1.2 кг за неделю" },
      { label: "Силовой прогресс", value: "+5 кг", helper: "Жим ногами" },
      { label: "Streak", value: "6 тренировок", helper: "Подряд по плану" },
    ],
    highlights: [
      { id: "hl-1", label: "Снижение веса", value: "-1.2 кг", helper: "За последние 14 дней" },
      { id: "hl-2", label: "Талия", value: "-2 см", helper: "Последние замеры" },
      { id: "hl-3", label: "Вода", value: "92%", helper: "От дневной цели" },
    ],
    recommendations: [
      { id: "rec-1", title: "Закрыть 3 тренировки на неделе", helper: "Осталась одна силовая сессия по плану" },
      { id: "rec-2", title: "Отправить замеры тренеру", helper: "Обновление нужно до конца недели" },
      { id: "rec-3", title: "Повторить технику приседаний", helper: "Сделать акцент на глубине и темпе" },
    ],
    heartRate: [
      { label: "Пн", value: 72 },
      { label: "Вт", value: 76 },
      { label: "Ср", value: 74 },
      { label: "Чт", value: 79 },
      { label: "Пт", value: 73 },
      { label: "Сб", value: 81 },
    ],
    nutritionPlan: [
      { id: "food-1", day: "День 1", title: "Овсянка и ягоды", helper: "Завтрак перед работой" },
      { id: "food-2", day: "День 2", title: "Боул с курицей", helper: "Обед с высоким белком" },
      { id: "food-3", day: "День 3", title: "Салат и рыба", helper: "Лёгкий ужин после тренировки" },
      { id: "food-4", day: "День 4", title: "Греческий йогурт", helper: "Перекус после прогулки" },
    ],
    notifications: [
      "Тренер обновил комментарий к приседаниям",
      "До замеров осталось 2 дня",
      "Доступна новая неделя программы",
    ],
    history: [
      { id: "h1", date: "Сегодня", status: "В процессе", detail: "Ноги и core" },
      { id: "h2", date: "24 апр", status: "Выполнена", detail: "Верх тела" },
      { id: "h3", date: "22 апр", status: "Выполнена", detail: "Круговая" },
    ],
    programSummary: {
      title: "Снижение веса 6 недель",
      week: "3 неделя программы",
      completed: "2 из 4 тренировок",
      nextDay: "Следующий день: Верх тела",
      updatedAt: "Обновлена 2 дня назад",
    },
    workoutEntry: {
      title: "Раздел тренировок",
      trainerState: "Есть план от тренера на неделю",
      soloState: "Можно записать самостоятельную тренировку",
      helper: "Откройте раздел, чтобы выполнить назначенную тренировку или добавить свою.",
    },
  };
}
