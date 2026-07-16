import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

type EmptyTeamStateProps = {
  onOpenDemo: () => void;
};

export function EmptyTeamState({ onOpenDemo }: EmptyTeamStateProps) {
  return (
    <section className="flex min-h-[66vh] items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-950/90 p-6 text-center">
      <div className="max-w-2xl">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-lime-300/10 text-lime-100 ring-1 ring-lime-300/20">
          <UserPlus className="size-7" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-50">Команда пока пустая</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Добавьте первого спортсмена, чтобы назначить тренировку и начать рабочий цикл команды.
        </p>

        <ol className="mx-auto mt-6 grid max-w-2xl gap-2 text-left sm:grid-cols-3" aria-label="Рабочий цикл тренера">
          {["Добавьте спортсмена", "Назначьте тренировку", "Получите результат и разберите"].map((step, index) => (
            <li key={step} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-black/20 px-3 py-3 text-sm text-zinc-300">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-300/10 text-xs font-semibold text-lime-100">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button asChild className="rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
            <Link href="/trainer/clients">
              <UserPlus className="size-4" />
              Добавить первого клиента
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={onOpenDemo} className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
            <Eye className="size-4" />
            Открыть демо-команду
          </Button>
        </div>

        <p className="mt-5 inline-flex items-center gap-2 text-xs text-zinc-600">
          <CheckCircle2 className="size-3.5" />
          Очередь появится после первого события, требующего решения.
        </p>
      </div>
    </section>
  );
}
