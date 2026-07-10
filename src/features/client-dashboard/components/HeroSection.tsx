import { ArrowRight, Check, Flame, Target } from "lucide-react";

type WeekDay = {
  label: string;
  completed: boolean;
  current?: boolean;
};

const weekDays: WeekDay[] = [
  { label: "ПН", completed: true },
  { label: "ВТ", completed: true },
  { label: "СР", completed: true },
  { label: "ЧТ", completed: true },
  { label: "ПТ", completed: true },
  { label: "СБ", completed: true, current: true },
  { label: "ВС", completed: false },
];

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_22%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,12,0.98))] px-5 py-5 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.45)] lg:min-h-[388px] lg:px-7 lg:py-6"
      aria-label="Фокус недели"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-[radial-gradient(circle_at_bottom,rgba(163,230,53,0.10),transparent_72%)]" />
      <div className="pointer-events-none absolute right-[12%] top-1/2 h-40 w-44 -translate-y-1/2 rounded-full bg-lime-300/14 blur-3xl lg:h-56 lg:w-64" />
      <div className="pointer-events-none absolute right-[18%] top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-emerald-300/10 blur-2xl" />

      <div className="relative z-10 mx-auto max-w-[1120px]">
        <div className="grid items-center gap-5 lg:grid-cols-[minmax(360px,520px)_minmax(420px,1fr)] lg:gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/15 bg-lime-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-lime-100">
              <Target className="h-3.5 w-3.5" />
              <span>Фокус недели</span>
            </div>

            <div className="max-w-md space-y-2">
              <h2 className="text-[2rem] font-semibold leading-[0.96] tracking-[-0.05em] text-zinc-50 sm:text-[2.45rem]">
                Закрыть план
                <br />
                без пропусков
              </h2>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <div className="min-w-[188px] rounded-[1.1rem] border border-zinc-800/80 bg-black/25 px-3.5 py-3">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Check className="h-4 w-4 text-lime-300" />
                  <span className="text-[11px] uppercase tracking-[0.14em]">Осталось</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-zinc-50">1 тренировка</p>
              </div>

              <div className="min-w-[188px] rounded-[1.1rem] border border-zinc-800/80 bg-black/25 px-3.5 py-3">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Flame className="h-4 w-4 text-lime-300" />
                  <span className="text-[11px] uppercase tracking-[0.14em]">Серия</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-zinc-50">6 дней подряд</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-full bg-lime-300 px-5 text-sm font-semibold text-black transition hover:bg-lime-200"
              >
                Начать тренировку
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>

              <button
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/70 px-5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
              >
                Выбрать тренировку
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center lg:justify-self-end">
            <div className="pointer-events-none absolute right-[12%] top-1/2 h-40 w-48 -translate-y-1/2 rounded-full bg-lime-300/14 blur-3xl lg:h-48 lg:w-60" />

            <div className="relative w-full max-w-[572px] lg:-translate-y-2">
              <div className="rounded-[1.95rem] border border-zinc-700/90 bg-[linear-gradient(180deg,rgba(46,46,54,0.94),rgba(18,18,24,0.98))] px-5 pb-5 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_72px_rgba(0,0,0,0.46)] backdrop-blur-xl lg:px-6 lg:pb-6 lg:pt-6">
                <div className="pointer-events-none absolute inset-x-8 top-0 flex -translate-y-1/2 justify-between px-2 lg:inset-x-10">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <span
                      key={index}
                      className="h-4 w-4 rounded-full border border-zinc-600/80 bg-zinc-950 shadow-[0_6px_12px_rgba(0,0,0,0.35)]"
                    />
                  ))}
                </div>

                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">План недели</p>
                    <p className="mt-1 text-sm font-medium text-zinc-200">Ритм без пропусков</p>
                  </div>

                  <div className="grid grid-cols-7 gap-3">
                    {weekDays.map((day) => (
                      <div key={day.label} className="flex flex-col items-center gap-2.5">
                        <span className="text-[11px] font-medium text-zinc-500">{day.label}</span>
                        <span
                          className={[
                            "flex h-11 w-11 items-center justify-center rounded-full border transition",
                            day.completed
                              ? "border-lime-300/25 bg-lime-300 text-black shadow-[0_0_18px_rgba(163,230,53,0.25)]"
                              : day.current
                                ? "border-lime-200/35 bg-zinc-900 text-zinc-200 shadow-[0_0_0_4px_rgba(163,230,53,0.08)]"
                                : "border-zinc-800 bg-zinc-950 text-zinc-600",
                          ].join(" ")}
                        >
                          {day.completed ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
