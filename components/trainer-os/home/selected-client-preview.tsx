import Link from "next/link";
import { ArrowRight, CheckCircle2, Dumbbell } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import type { TeamClient } from "./types";

type SelectedClientPreviewProps = {
  client: TeamClient;
};

export function SelectedClientPreview({ client }: SelectedClientPreviewProps) {
  return (
    <article className="rounded-[1.7rem] border border-zinc-800/85 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(7,7,9,0.98))] p-4">
      <div className="flex items-start gap-3">
        <Avatar className="size-12 border border-lime-300/18 bg-zinc-950">
          <AvatarFallback className="bg-zinc-900 text-sm font-semibold text-zinc-100">{client.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-50">{client.name}</p>
          <p className="mt-1 text-xs text-zinc-500">{client.goal}</p>
        </div>
      </div>

      <div className="mt-4 rounded-[1.2rem] border border-lime-300/12 bg-lime-300/[0.045] px-3.5 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-lime-100">
          <CheckCircle2 className="size-4" />
          Следующее действие не требуется
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Клиент идет по плану. {client.nextWorkout ? `Следующая тренировка: ${client.nextWorkout}.` : "Следующая тренировка пока не указана."}
          {" "}Последняя активность: {client.lastActivity}.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
          <Link href={`/trainer/clients/${client.id}`}>
            Открыть клиента
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
          <Link href="/trainer/builder">
            <Dumbbell className="size-4" />
            Подготовить тренировку
          </Link>
        </Button>
      </div>
    </article>
  );
}
