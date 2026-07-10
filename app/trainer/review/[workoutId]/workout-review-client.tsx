"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Dumbbell,
  MessageSquareText,
  PenLine,
  Sparkles,
  Timer,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ExerciseDetailSheet } from "@/components/trainer/exercise-detail-sheet";
import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getDemoLibraryExercises } from "@/lib/demo-data";
import type { ExerciseLibraryRow } from "@/lib/exercise-library";
import { cn } from "@/lib/utils";

type DeviationTone = "good" | "warning" | "danger";

type CompletedSet = {
  id: string;
  weight: string;
  reps: string;
  note?: string;
};

type ReviewExercise = {
  id: string;
  title: string;
  plan: string;
  actual: string;
  deviation: string;
  deviationTone: DeviationTone;
  sets: CompletedSet[];
  clientComment?: string;
  libraryExercise: ExerciseLibraryRow;
};

type WorkoutReview = {
  id: string;
  client: {
    id: string;
    name: string;
    initials: string;
    goal: string;
    href: string;
  };
  title: string;
  dateLabel: string;
  status: "needs-review" | "reviewed";
  rpe: number;
  feeling: string;
  durationMin: number;
  exerciseCount: number;
  setCount: number;
  tonnageKg: number;
  bestSet: string;
  summaryNote: string;
  exercises: ReviewExercise[];
};

const commentTemplates = [
  {
    id: "progress",
    label: "Прогрессия",
    text: "Техника стабильная. На следующей тренировке добавим +2.5 кг в первом рабочем подходе, но оставим запас 1-2 повтора.",
  },
  {
    id: "deload",
    label: "Снизить нагрузку",
    text: "По RPE видно, что нагрузка сегодня была на верхней границе. Следующую тренировку сделаем легче и вернём объём постепенно.",
  },
  {
    id: "video",
    label: "Запросить видео",
    text: "По цифрам вижу просадку в последних подходах. На следующей тренировке пришли видео первого и последнего рабочего подхода.",
  },
  {
    id: "support",
    label: "Поддержать",
    text: "Хорошая работа после паузы. Главное сейчас — вернуть ритм, поэтому фиксируем выполнение и не форсируем вес.",
  },
];

function createLibraryExercise(title: string, imageUrl: string, muscleGroup: string): ExerciseLibraryRow {
  return {
    id: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    muscle_group: muscleGroup,
    image_url: imageUrl,
    equipment: "Свободный вес",
    difficulty: "Средняя",
    description: "Базовое движение из библиотеки тренера для проверки техники и нагрузки.",
    technique_steps: ["Зафиксируйте стартовую позицию", "Выполните движение без рывка", "Вернитесь в исходное положение под контролем"],
    tips: ["Оставляйте запас", "Не теряйте контроль в негативной фазе"],
    muscle_groups: [muscleGroup],
    video_url: null,
    is_system: true,
    owner_user_id: null,
    source_exercise_id: null,
    created_at: null,
    updated_at: null,
  };
}

function findLibraryExercise(title: string, fallbackImage: string, muscleGroup: string) {
  const library = getDemoLibraryExercises();
  return (
    library.find((exercise) => exercise.title.toLowerCase() === title.toLowerCase()) ??
    library.find((exercise) => exercise.title.toLowerCase().includes(title.toLowerCase())) ??
    createLibraryExercise(title, fallbackImage, muscleGroup)
  );
}

const bench = findLibraryExercise("Жим штанги лежа", "/exercises/Chest/Жим штанги лежа.webp", "Грудь");
const row = findLibraryExercise("Тяга штанги в наклоне", "/exercises/Back/Тяга штанги в наклоне.webp", "Спина");
const dumbbellPress = findLibraryExercise("Жим гантелей лежа", "/exercises/Chest/Жим гантелей лежа.webp", "Грудь");
const latPulldown = findLibraryExercise("Тяга верхнего блока", "/exercises/Back/Тяга верхнего блока.webp", "Спина");
const cableRow = findLibraryExercise("Тяга горизонтального блока сидя с V-образной рукоятью", "/exercises/Back/Тяга горизонтального блока сидя с V-образной рукоятью.webp", "Спина");
const fly = findLibraryExercise("Сведение рук в кроссовере", "/exercises/Chest/Сведение рук в кроссовере.webp", "Грудь");
const squat = findLibraryExercise("Приседания со штангой", "/exercises/Quadriceps/Приседания со штангой.webp", "Ноги");
const shoulderPress = findLibraryExercise("Жим на плечи сидя", "/exercises/Shoulders/Жим на плечи сидя.webp", "Плечи");

const workoutReviews: Record<string, WorkoutReview> = {
  "artem-smirnov-2026-06-10": {
    id: "artem-smirnov-2026-06-10",
    client: {
      id: "artem-smirnov",
      name: "Артём Смирнов",
      initials: "АС",
      goal: "Набор массы",
      href: "/trainer/clients/artem-smirnov",
    },
    title: "Грудь + Спина",
    dateLabel: "10 июня 2026",
    status: "needs-review",
    rpe: 9,
    feeling: "Тяжело, мало сна",
    durationMin: 72,
    exerciseCount: 6,
    setCount: 18,
    tonnageKg: 7420,
    bestSet: "Жим штанги 80 кг x 6",
    summaryNote: "После двух пропусков клиент вернулся, но рабочие подходы ушли в высокий RPE.",
    exercises: [
      {
        id: "bench",
        title: "Жим штанги лёжа",
        plan: "80 кг x 8",
        actual: "80 кг x 6",
        deviation: "-2 повтора",
        deviationTone: "danger",
        sets: [
          { id: "1", weight: "55 кг", reps: "8", note: "разминка" },
          { id: "2", weight: "70 кг", reps: "6" },
          { id: "3", weight: "80 кг", reps: "6", note: "RPE 9" },
        ],
        clientComment: "Последний подход дался тяжело, штанга замедлилась в середине.",
        libraryExercise: bench,
      },
      {
        id: "barbell-row",
        title: "Тяга штанги в наклоне",
        plan: "60 кг x 10",
        actual: "65 кг x 10",
        deviation: "+5 кг",
        deviationTone: "good",
        sets: [
          { id: "1", weight: "55 кг", reps: "10" },
          { id: "2", weight: "65 кг", reps: "10" },
          { id: "3", weight: "65 кг", reps: "9" },
        ],
        libraryExercise: row,
      },
      {
        id: "db-press",
        title: "Жим гантелей лёжа",
        plan: "28 кг x 8",
        actual: "26 кг x 8",
        deviation: "-2 кг",
        deviationTone: "warning",
        sets: [
          { id: "1", weight: "24 кг", reps: "10" },
          { id: "2", weight: "26 кг", reps: "8" },
          { id: "3", weight: "26 кг", reps: "7" },
        ],
        libraryExercise: dumbbellPress,
      },
      {
        id: "lat-pulldown",
        title: "Тяга верхнего блока",
        plan: "58 кг x 12",
        actual: "58 кг x 12",
        deviation: "по плану",
        deviationTone: "good",
        sets: [
          { id: "1", weight: "50 кг", reps: "12" },
          { id: "2", weight: "58 кг", reps: "12" },
          { id: "3", weight: "58 кг", reps: "11" },
        ],
        libraryExercise: latPulldown,
      },
      {
        id: "cable-row",
        title: "Горизонтальная тяга",
        plan: "62 кг x 10",
        actual: "62 кг x 8",
        deviation: "-2 повтора",
        deviationTone: "warning",
        sets: [
          { id: "1", weight: "54 кг", reps: "10" },
          { id: "2", weight: "62 кг", reps: "8" },
          { id: "3", weight: "58 кг", reps: "9" },
        ],
        clientComment: "К концу тренировки спина забилась, снизил темп.",
        libraryExercise: cableRow,
      },
      {
        id: "fly",
        title: "Сведение рук в кроссовере",
        plan: "18 кг x 12",
        actual: "18 кг x 12",
        deviation: "по плану",
        deviationTone: "good",
        sets: [
          { id: "1", weight: "16 кг", reps: "12" },
          { id: "2", weight: "18 кг", reps: "12" },
          { id: "3", weight: "18 кг", reps: "12" },
        ],
        libraryExercise: fly,
      },
    ],
  },
  "irina-kozlova-2026-06-12": {
    id: "irina-kozlova-2026-06-12",
    client: {
      id: "irina-kozlova",
      name: "Ирина Козлова",
      initials: "ИК",
      goal: "Сила и тонус",
      href: "/trainer/clients/irina-kozlova",
    },
    title: "Верх тела · техника жима",
    dateLabel: "12 июня 2026",
    status: "needs-review",
    rpe: 8,
    feeling: "Нормально",
    durationMin: 64,
    exerciseCount: 4,
    setCount: 14,
    tonnageKg: 6420,
    bestSet: "Жим гантелей 18 кг x 8",
    summaryNote: "Стабильное выполнение, просит проверить траекторию в жиме.",
    exercises: [
      {
        id: "db-press",
        title: "Жим гантелей лёжа",
        plan: "18 кг x 8",
        actual: "18 кг x 8",
        deviation: "по плану",
        deviationTone: "good",
        sets: [
          { id: "1", weight: "16 кг", reps: "10" },
          { id: "2", weight: "18 кг", reps: "8" },
          { id: "3", weight: "18 кг", reps: "8" },
        ],
        clientComment: "На втором подходе правая рука чуть уводила гантель внутрь.",
        libraryExercise: dumbbellPress,
      },
      {
        id: "lat-pulldown",
        title: "Тяга верхнего блока",
        plan: "42 кг x 12",
        actual: "42 кг x 11",
        deviation: "-1 повтор",
        deviationTone: "warning",
        sets: [
          { id: "1", weight: "36 кг", reps: "12" },
          { id: "2", weight: "42 кг", reps: "11" },
          { id: "3", weight: "40 кг", reps: "12" },
        ],
        libraryExercise: latPulldown,
      },
    ],
  },
  "maria-volkova-2026-06-09": {
    id: "maria-volkova-2026-06-09",
    client: {
      id: "maria-volkova",
      name: "Мария Волкова",
      initials: "МВ",
      goal: "Снижение веса",
      href: "/trainer/clients/maria-volkova",
    },
    title: "Низ тела · стабильное выполнение",
    dateLabel: "9 июня 2026",
    status: "needs-review",
    rpe: 7,
    feeling: "Хорошо",
    durationMin: 58,
    exerciseCount: 5,
    setCount: 16,
    tonnageKg: 7120,
    bestSet: "Приседания 55 кг x 8",
    summaryNote: "Ритм хороший, можно закрепить прогрессию без изменения объёма.",
    exercises: [
      {
        id: "squat",
        title: "Приседания со штангой",
        plan: "55 кг x 8",
        actual: "55 кг x 8",
        deviation: "по плану",
        deviationTone: "good",
        sets: [
          { id: "1", weight: "45 кг", reps: "10" },
          { id: "2", weight: "55 кг", reps: "8" },
          { id: "3", weight: "55 кг", reps: "8" },
        ],
        libraryExercise: squat,
      },
      {
        id: "shoulder-press",
        title: "Жим на плечи сидя",
        plan: "14 кг x 10",
        actual: "14 кг x 10",
        deviation: "по плану",
        deviationTone: "good",
        sets: [
          { id: "1", weight: "12 кг", reps: "10" },
          { id: "2", weight: "14 кг", reps: "10" },
          { id: "3", weight: "14 кг", reps: "9" },
        ],
        libraryExercise: shoulderPress,
      },
    ],
  },
};

function formatKg(value: number) {
  return `${value.toLocaleString("ru-RU")} кг`;
}

function deviationClasses(tone: DeviationTone) {
  switch (tone) {
    case "good":
      return "border-lime-300/20 bg-lime-300/10 text-lime-100";
    case "warning":
      return "border-amber-300/24 bg-amber-300/10 text-amber-100";
    default:
      return "border-rose-300/24 bg-rose-300/10 text-rose-100";
  }
}

export function WorkoutReviewClient({ workoutId }: { workoutId: string }) {
  const workout = workoutReviews[workoutId] ?? workoutReviews["artem-smirnov-2026-06-10"];
  const [selectedExercise, setSelectedExercise] = useState<ExerciseLibraryRow | null>(null);
  const [comment, setComment] = useState(commentTemplates[0].text);
  const [reviewed, setReviewed] = useState(workout.status === "reviewed");

  const riskySignals = useMemo(() => {
    const signals = [];
    if (workout.rpe >= 9) signals.push(`RPE ${workout.rpe}`);
    if (/плохо|тяжело|сон|устал/i.test(workout.feeling)) signals.push(workout.feeling);
    return signals;
  }, [workout.feeling, workout.rpe]);

  function markReviewed() {
    setReviewed(true);
    toast.success("Тренировка отмечена разобранной", {
      description: "Attention Item закрыт, разбор исчезнет из очереди.",
    });
  }

  return (
    <TrainerShell
      title="Workout Review"
      description="Разбор фактического выполнения и обратная связь клиенту."
      headerAction={
        <Button asChild className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
          <Link href="/trainer/dashboard">
            К очереди
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <div className="space-y-5 text-zinc-100">
        <section className="overflow-hidden rounded-[2rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_top_left,rgba(163,230,53,0.14),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(3,7,18,0.98))] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/12 text-base font-semibold text-lime-100">
                {workout.client.initials}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{workout.client.name}</h1>
                  <Badge
                    className={cn(
                      "rounded-full border",
                      reviewed
                        ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                        : "border-amber-300/24 bg-amber-300/10 text-amber-100"
                    )}
                  >
                    {reviewed ? "Разобрано" : "Ждёт разбора"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {workout.client.goal} · {workout.dateLabel} · {workout.title}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-4 lg:w-[560px]">
              <ContextMetric label="RPE" value={String(workout.rpe)} hot={workout.rpe >= 9} />
              <ContextMetric label="Самочувствие" value={workout.feeling} hot={riskySignals.length > 0} />
              <ContextMetric label="Время" value={`${workout.durationMin} мин`} />
              <Button asChild variant="outline" className="h-full rounded-2xl border-zinc-700 bg-black/20 text-zinc-100 hover:bg-zinc-900">
                <Link href={workout.client.href}>
                  <UserRound className="mr-2 h-4 w-4" />
                  Открыть клиента
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {riskySignals.length ? (
          <section className="flex flex-col gap-3 rounded-[1.5rem] border border-amber-300/18 bg-amber-300/8 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-full border border-amber-300/20 bg-amber-300/12 p-2 text-amber-100">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-50">Нужно учесть нагрузку перед следующим планом</p>
                <p className="mt-1 text-sm text-amber-100/70">{riskySignals.join(" · ")}</p>
              </div>
            </div>
            <Button asChild variant="outline" className="rounded-full border-amber-300/20 bg-black/18 text-amber-50 hover:bg-amber-300/10">
              <Link href={`${workout.client.href}#program`}>Скорректировать программу</Link>
            </Button>
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-5">
          <SummaryCard icon={Dumbbell} label="Тренировка" value={workout.title} helper={`${workout.exerciseCount} упражнений`} />
          <SummaryCard icon={ClipboardCheck} label="Подходы" value={String(workout.setCount)} helper="фактически выполнено" />
          <SummaryCard icon={Timer} label="Время" value={`${workout.durationMin} мин`} helper="длительность" />
          <SummaryCard icon={Sparkles} label="Тоннаж" value={formatKg(workout.tonnageKg)} helper="общая работа" />
          <SummaryCard icon={CheckCircle2} label="Лучший сет" value={workout.bestSet} helper="ключевой результат" />
        </section>

        <section className="rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/72 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Plan vs Actual</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Отклонения от плана</h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-400">{workout.summaryNote}</p>
          </div>

          <div className="mt-4 divide-y divide-zinc-800/80 overflow-hidden rounded-[1.25rem] border border-zinc-800 bg-black/18">
            {workout.exercises.map((exercise) => (
              <div key={exercise.id} className="grid gap-3 p-3 sm:grid-cols-[1.3fr_0.8fr_0.8fr_auto] sm:items-center">
                <div>
                  <p className="font-medium text-zinc-100">{exercise.title}</p>
                  {exercise.clientComment ? (
                    <p className="mt-1 text-xs text-zinc-500">Есть комментарий клиента</p>
                  ) : null}
                </div>
                <PlanFact label="План" value={exercise.plan} />
                <PlanFact label="Факт" value={exercise.actual} />
                <Badge className={cn("justify-center rounded-full border px-3 py-1.5", deviationClasses(exercise.deviationTone))}>
                  {exercise.deviation}
                </Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Exercise review</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Фактическое выполнение</h2>
              </div>
              <Badge className="rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-300">
                {workout.exerciseCount} упражнений
              </Badge>
            </div>

            {workout.exercises.map((exercise) => (
              <article
                key={exercise.id}
                className="grid gap-4 rounded-[1.75rem] border border-zinc-800/90 bg-zinc-950/72 p-4 sm:grid-cols-[164px_minmax(0,1fr)]"
              >
                <button
                  type="button"
                  onClick={() => setSelectedExercise(exercise.libraryExercise)}
                  className="group relative h-40 overflow-hidden rounded-[1.25rem] border border-zinc-800 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.99))]"
                >
                  <Image
                    src={exercise.libraryExercise.image_url ?? "/placeholder-logo.png"}
                    alt={exercise.title}
                    width={240}
                    height={200}
                    className="h-full w-full object-contain object-top p-3 transition duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="absolute bottom-3 left-3 right-3 inline-flex items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/86 px-3 py-1.5 text-xs font-medium text-zinc-200">
                    Открыть технику
                    <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                  </span>
                </button>

                <div className="min-w-0">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-zinc-50">{exercise.title}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className="rounded-full border border-zinc-800 bg-black/18 text-zinc-300">План: {exercise.plan}</Badge>
                        <Badge className="rounded-full border border-zinc-800 bg-black/18 text-zinc-300">Факт: {exercise.actual}</Badge>
                        <Badge className={cn("rounded-full border", deviationClasses(exercise.deviationTone))}>{exercise.deviation}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {exercise.sets.map((set) => (
                      <div key={set.id} className="rounded-[1rem] border border-zinc-800 bg-black/18 p-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">#{set.id}</p>
                        <p className="mt-1 text-base font-semibold text-zinc-50">
                          {set.weight} x {set.reps}
                        </p>
                        {set.note ? <p className="mt-1 text-xs text-zinc-500">{set.note}</p> : null}
                      </div>
                    ))}
                  </div>

                  {exercise.clientComment ? (
                    <div className="mt-4 rounded-[1.15rem] border border-cyan-300/14 bg-cyan-300/8 p-3">
                      <div className="flex items-start gap-2">
                        <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.14em] text-cyan-100/70">Комментарий клиента</p>
                          <p className="mt-1 text-sm leading-relaxed text-zinc-300">«{exercise.clientComment}»</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <aside className="h-fit rounded-[1.75rem] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98))] p-4 shadow-2xl shadow-black/20 xl:sticky xl:top-24">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Coach comment</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">Обратная связь</h2>
              </div>
              <PenLine className="h-5 w-5 text-lime-100" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {commentTemplates.map((template) => (
                <Button
                  key={template.id}
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-zinc-800 bg-black/18 px-3 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
                  onClick={() => setComment(template.text)}
                >
                  {template.label}
                </Button>
              ))}
            </div>

            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Техника стабильная. На следующей тренировке добавим +2.5 кг в первом рабочем подходе."
              className="mt-4 min-h-[220px] resize-none rounded-[1.25rem] border-zinc-800 bg-black/24 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600"
            />

            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                className="h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200"
                disabled={reviewed || !comment.trim()}
                onClick={markReviewed}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {reviewed ? "Разбор закрыт" : "Отметить разобранной"}
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full border-zinc-800 bg-black/18 text-zinc-100 hover:bg-zinc-900">
                <Link href={workout.client.href}>Открыть клиента</Link>
              </Button>
              <Button asChild variant="ghost" className="h-11 rounded-full text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50">
                <Link href={`${workout.client.href}#program`}>Скорректировать программу</Link>
              </Button>
            </div>
          </aside>
        </section>
      </div>

      <ExerciseDetailSheet exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
    </TrainerShell>
  );
}

function ContextMetric({ label, value, hot = false }: { label: string; value: string; hot?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2.5",
        hot ? "border-amber-300/24 bg-amber-300/10" : "border-zinc-800 bg-black/18"
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-semibold", hot ? "text-amber-50" : "text-zinc-100")}>{value}</p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-800/90 bg-zinc-950/72 p-4">
      <Icon className="h-4 w-4 text-lime-100" />
      <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-5 text-zinc-50">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{helper}</p>
    </div>
  );
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}
