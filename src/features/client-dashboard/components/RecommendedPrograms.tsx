import { ArrowRight } from "lucide-react";

type ProgramCard = {
  title: string;
  description: string;
  difficulty: string;
  duration: string;
  price: string;
};

const programs: ProgramCard[] = [
  {
    title: "Сушка 4 недели",
    description: "Плотный цикл для снижения веса и удержания тонуса без лишнего объёма.",
    difficulty: "Средний",
    duration: "4 недели",
    price: "от 2 990 ₽",
  },
  {
    title: "Жим 100 кг",
    description: "Программа на рост силы и технику жима для уверенного прогресса.",
    difficulty: "Продвинутый",
    duration: "6 недель",
    price: "от 3 490 ₽",
  },
  {
    title: "Домашний тонус",
    description: "Тренировки дома без сложного оборудования для стабильного ритма.",
    difficulty: "Базовый",
    duration: "5 недель",
    price: "от 1 990 ₽",
  },
];

export function RecommendedPrograms() {
  return (
    <section className="rounded-[1.8rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.06),transparent_26%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] p-5 text-zinc-100 shadow-[0_18px_48px_rgba(0,0,0,0.34)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Рекомендуем тебе
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-zinc-50">
            Программы под твою цель и текущий уровень
          </h3>
        </div>

        <span className="rounded-full border border-lime-300/15 bg-lime-300/8 px-3 py-1 text-[11px] font-medium text-lime-100">
          3 подборки
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {programs.map((program) => (
          <article
            key={program.title}
            className="group rounded-[1.35rem] border border-zinc-800/85 bg-black/20 p-4 transition hover:border-zinc-700 hover:bg-zinc-950/75"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold tracking-[-0.02em] text-zinc-50">
                  {program.title}
                </h4>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{program.description}</p>
              </div>

              <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-950/80 px-2.5 py-1 text-[11px] text-zinc-300">
                {program.difficulty}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-zinc-800 bg-zinc-950/75 px-2.5 py-1 text-xs text-zinc-400">
                {program.duration}
              </span>
              <span className="rounded-full border border-lime-300/15 bg-lime-300/8 px-2.5 py-1 text-xs font-medium text-lime-100">
                {program.price}
              </span>
            </div>

            <button
              type="button"
              className="mt-5 inline-flex items-center text-sm font-medium text-zinc-200 transition group-hover:text-zinc-50"
            >
              Подробнее
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
