import { ArrowRight, MessageCircle, Sparkles } from "lucide-react";

const trainer = {
  name: "Алексей Романов",
  subtitle: "Romanov Coaching",
  status: "На связи",
  message: "Попробуй увеличить вес в жиме ногами на следующей тренировке.",
};

export function TrainerCard() {
  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.08),transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(12,12,14,0.98))] p-5 text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-[radial-gradient(circle_at_bottom,rgba(163,230,53,0.12),transparent_70%)]" />

      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Тренер
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-lime-300/20 bg-lime-300/10 text-sm font-semibold text-lime-100">
                АР
              </div>

              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-zinc-50">
                  {trainer.name}
                </h3>
                <p className="text-sm text-zinc-400">{trainer.subtitle}</p>
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/15 bg-lime-300/10 px-3 py-1 text-[11px] font-medium text-lime-100">
            <Sparkles className="h-3.5 w-3.5" />
            {trainer.status}
          </span>
        </div>

        <div className="rounded-[1.35rem] border border-zinc-800/80 bg-black/20 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300">
              <MessageCircle className="h-4 w-4" />
            </span>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                Последнее сообщение
              </p>
              <p className="max-w-sm text-sm leading-6 text-zinc-200">
                {trainer.message}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-full bg-lime-300 px-4.5 text-sm font-semibold text-black transition hover:bg-lime-200"
          >
            Написать тренеру
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>

          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/70 px-4.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
          >
            Открыть план
          </button>
        </div>
      </div>
    </section>
  );
}
