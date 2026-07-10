import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Dumbbell, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TeamClient } from "./types";

type ActionQueueItemProps = {
  client: TeamClient;
  isFirst?: boolean;
  onComplete: (clientId: string) => void;
  onQuickAssign: (client: TeamClient) => void;
  onWorkoutReview: (client: TeamClient) => void;
};

export function ActionQueueItem({ client, isFirst, onComplete, onQuickAssign, onWorkoutReview }: ActionQueueItemProps) {
  const actionLabel = getActionLabel(client);
  const handlePrimaryAction =
    client.primaryAction === "assign"
      ? () => onQuickAssign(client)
      : client.primaryAction === "review"
        ? () => onWorkoutReview(client)
        : () => onComplete(client.id);

  return (
    <article
      className={cn(
        "rounded-[26px] border bg-zinc-950/70 p-4 shadow-xl shadow-black/20 transition",
        isFirst ? "border-amber-300/30" : "border-zinc-800/85"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-11 border border-zinc-800 bg-zinc-950">
            <AvatarFallback className="bg-zinc-900 text-xs font-semibold text-zinc-100">{client.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-zinc-50">{client.name}</h3>
            <p className="mt-1 truncate text-xs text-zinc-500">{client.goal}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-xs",
            client.priority === "high"
              ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
              : "border-zinc-800 bg-black/20 text-zinc-400"
          )}
        >
          {client.priority === "high" ? "Срочно" : "Сегодня"}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800/75 bg-black/22 p-3">
        <p className="text-sm font-medium text-zinc-100">{client.issue}</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">{client.context}</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
          <Clock3 className="size-3.5" />
          {client.lastActivity}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={handlePrimaryAction}
          className="rounded-full bg-lime-300 px-3 text-black hover:bg-lime-200"
        >
          {client.primaryAction === "assign" ? <Dumbbell className="size-4" /> : null}
          {client.primaryAction === "review" ? <CheckCircle2 className="size-4" /> : null}
          {client.primaryAction === "open_client" || !client.primaryAction ? <UserRound className="size-4" /> : null}
          {actionLabel}
        </Button>
        <Button asChild variant="outline" className="rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
          <Link href={`/trainer/clients/${client.id}`}>
            Открыть клиента
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

function getActionLabel(client: TeamClient) {
  if (client.primaryAction === "assign") return "Назначить";
  if (client.primaryAction === "review") return "Разобрать";
  return "Открыть клиента";
}
