import Link from "next/link";
import { ArrowRight, MessageCircle, MoreHorizontal, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PriorityBadge } from "./priority-badge";
import { StatusBadge } from "./status-badge";
import type { TrainerOperatingClient } from "./types";

type ClientActionRowProps = {
  client: TrainerOperatingClient;
  onQuickAssign: (client: TrainerOperatingClient) => void;
};

export function ClientActionRow({ client, onQuickAssign }: ClientActionRowProps) {
  const primaryAction = renderPrimaryAction(client, onQuickAssign);
  const secondaryHref = client.action === "open_client" ? client.secondaryHref : `/trainer/clients/${client.id}`;
  const secondaryLabel = client.action === "open_client" ? client.secondaryLabel : "Открыть";

  return (
    <article className="grid gap-3 border-t border-zinc-800/80 px-4 py-3 first:border-t-0 lg:grid-cols-[minmax(220px,1.25fr)_minmax(150px,0.9fr)_minmax(170px,1fr)_minmax(170px,1fr)_minmax(170px,0.95fr)_minmax(210px,0.95fr)] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-10 border border-zinc-800 bg-zinc-950">
          <AvatarFallback className="bg-zinc-900 text-xs font-semibold text-zinc-200">{client.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <Link href={`/trainer/clients/${client.id}`} className="truncate text-sm font-semibold text-zinc-50 hover:text-lime-100">
            {client.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{client.goal}</p>
        </div>
      </div>

      <TextCell label="Сегодня" primary={client.todayState} muted={client.reason} />
      <WorkoutCell label="Следующая" workout={client.nextWorkout} empty="Нет следующей" />
      <WorkoutCell label="Последняя" workout={client.lastWorkout} empty="Истории пока нет" />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={client.status} />
        <PriorityBadge priority={client.priority} />
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {primaryAction}
        <Button asChild variant="outline" size="sm" className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
          <Link href={secondaryHref}>{secondaryLabel}</Link>
        </Button>
        <Button variant="ghost" size="icon-sm" className="rounded-full text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200" aria-label={`Еще действия для ${client.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
    </article>
  );
}

function renderPrimaryAction(client: TrainerOperatingClient, onQuickAssign: (client: TrainerOperatingClient) => void) {
  if (client.action === "quick_assign") {
    return (
      <Button type="button" size="sm" onClick={() => onQuickAssign(client)} className="rounded-full bg-lime-300 px-3 text-xs font-semibold text-black hover:bg-lime-200">
        Назначить
        <ArrowRight className="size-3.5" />
      </Button>
    );
  }

  if (client.action === "open_review") {
    return (
      <Button asChild size="sm" className="rounded-full bg-lime-300 px-3 text-xs font-semibold text-black hover:bg-lime-200">
        <Link href={client.reviewHref ?? `/trainer/review/${client.id}-mock`}>
          Разобрать
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    );
  }

  if (client.action === "message") {
    return (
      <Button asChild size="sm" className="rounded-full bg-lime-300 px-3 text-xs font-semibold text-black hover:bg-lime-200">
        <Link href={client.messageHref ?? "/trainer/messages"}>
          <MessageCircle className="size-3.5" />
          Сообщение
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild size="sm" className="rounded-full bg-lime-300 px-3 text-xs font-semibold text-black hover:bg-lime-200">
      <Link href={`/trainer/clients/${client.id}`}>
        <UserRound className="size-3.5" />
        Открыть
      </Link>
    </Button>
  );
}

function TextCell({ label, primary, muted }: { label: string; primary: string; muted?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600 lg:hidden">{label}</p>
      <p className="truncate text-sm text-zinc-200">{primary}</p>
      {muted ? <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{muted}</p> : null}
    </div>
  );
}

function WorkoutCell({ label, workout, empty }: { label: string; workout: TrainerOperatingClient["nextWorkout"]; empty: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600 lg:hidden">{label}</p>
      <p className={cn("truncate text-sm", workout ? "text-zinc-200" : "text-zinc-500")}>{workout?.name ?? empty}</p>
      <p className="mt-1 truncate text-xs text-zinc-500">{workout?.detail ?? workout?.meta ?? "Нужен шаг тренера"}</p>
    </div>
  );
}
