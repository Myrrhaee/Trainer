import Link from "next/link";
import { CheckCircle2, ClipboardList, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

type CalmTeamStateProps = {
  onTrackCount: number;
};

export function CalmTeamState({ onTrackCount }: CalmTeamStateProps) {
  return (
    <section className="rounded-[32px] border border-lime-300/16 bg-lime-300/7 p-5 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-lime-300/12 text-lime-100 ring-1 ring-lime-300/20">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lime-200/70">{onTrackCount} клиентов в ритме</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Все клиенты идут по плану</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Нет большой пустой очереди. Можно спокойно проверить события команды или подготовить шаблоны на неделю.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
            <Link href="/trainer/clients">
              <Users className="size-4" />
              Открыть команду
            </Link>
          </Button>
          <Button asChild className="rounded-full bg-lime-300 text-black hover:bg-lime-200">
            <Link href="/trainer/builder">
              <ClipboardList className="size-4" />
              Шаблоны
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
