import Link from "next/link";
import { ArrowRight, CheckCircle2, Dumbbell, MessageCircle, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TeamClient } from "./types";

type ActionStoryCardProps = {
  dataClientId: string;
  client: TeamClient;
  active: boolean;
  onComplete: (clientId: string) => void;
};

export function ActionStoryCard({ dataClientId, client, active, onComplete }: ActionStoryCardProps) {
  const action = getAction(client);
  const ActionIcon = action.icon;

  function handlePrimaryAction() {
    onComplete(client.id);
  }

  return (
    <article
      data-client-id={dataClientId}
      className={cn(
        "flex min-h-[430px] flex-col justify-between rounded-[1.7rem] border bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(7,7,9,0.98))] p-4 transition",
        active ? "border-lime-300/30 shadow-[0_18px_45px_rgba(163,230,53,0.09)] ring-1 ring-lime-300/12" : "border-zinc-800/85"
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-12 border border-zinc-800 bg-zinc-950">
              <AvatarFallback className="bg-zinc-900 text-sm font-semibold text-zinc-100">{client.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-zinc-50">{client.name}</h3>
              <p className="mt-1 truncate text-xs text-zinc-500">{client.goal}</p>
            </div>
          </div>
          <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs", statusClass(client))}>{client.stateLabel}</span>
        </div>

        <div className="mt-5 rounded-[1.25rem] border border-zinc-800/80 bg-black/18 px-3.5 py-3">
          <p className="text-sm font-semibold text-zinc-100">{client.issue}</p>
          <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-zinc-500">{client.context}</p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-600">
          <span>Активность</span>
          <span className="text-zinc-400">{client.lastActivity}</span>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Button type="button" onClick={handlePrimaryAction} className="h-11 w-full rounded-full bg-lime-300 text-black hover:bg-lime-200">
          <ActionIcon className="size-4" />
          {action.label}
        </Button>
        <Button asChild variant="outline" className="h-10 w-full rounded-full border-zinc-700 bg-black/20 text-zinc-200 hover:bg-zinc-900">
          <Link href={`/trainer/clients/${client.id}`}>
            Открыть клиента
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

function getAction(client: TeamClient) {
  if (client.primaryAction === "assign") return { label: "Назначить тренировку", icon: Dumbbell };
  if (client.primaryAction === "review") return { label: "Разобрать", icon: CheckCircle2 };
  if (client.primaryAction === "message") return { label: "Написать", icon: MessageCircle };
  return { label: "Открыть клиента", icon: UserRound };
}

function statusClass(client: TeamClient) {
  if (client.state === "waiting_review") return "border-rose-300/20 bg-rose-300/8 text-rose-100";
  if (client.state === "no_next_workout") return "border-red-400/22 bg-red-400/8 text-red-100";
  if (client.state === "needs_adjustment") return "border-yellow-300/20 bg-yellow-300/8 text-yellow-100";
  return "border-zinc-800 bg-black/20 text-zinc-400";
}
