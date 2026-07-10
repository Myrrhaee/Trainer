import Link from "next/link";
import { Eye, UserPlus, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

type EmptyTeamStateProps = {
  onOpenDemo: () => void;
};

export function EmptyTeamState({ onOpenDemo }: EmptyTeamStateProps) {
  return (
    <section className="flex min-h-[66vh] items-center justify-center rounded-[2rem] border border-zinc-800/80 bg-zinc-950/90 p-6 text-center">
      <div className="max-w-xl">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-lime-300/10 text-lime-100 ring-1 ring-lime-300/20">
          <UserPlus className="size-7" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-50">Команда пока пустая</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Добавьте первого клиента или откройте демо-команду, чтобы увидеть, как будет работать штаб тренера.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button asChild className="rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
            <Link href="/trainer/clients">
              <UserPlus className="size-4" />
              Добавить первого клиента
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={onOpenDemo} className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
            <Eye className="size-4" />
            Открыть демо-команду
          </Button>
          <Button asChild variant="ghost" className="rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
            <Link href="/trainer/builder">
              <WandSparkles className="size-4" />
              Создать первый шаблон
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
