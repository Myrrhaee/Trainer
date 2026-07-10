import type { RefObject } from "react";

import { ActionQueueItem } from "./action-queue-item";
import type { TeamClient } from "./types";

type ActionQueueProps = {
  clients: TeamClient[];
  firstItemRef: RefObject<HTMLDivElement | null>;
  onComplete: (clientId: string) => void;
  onQuickAssign: (client: TeamClient) => void;
  onWorkoutReview: (client: TeamClient) => void;
};

export function ActionQueue({ clients, firstItemRef, onComplete, onQuickAssign, onWorkoutReview }: ActionQueueProps) {
  if (clients.length === 0) return null;
  const visibleClients = clients.slice(0, 5);
  const hiddenCount = clients.length - visibleClients.length;

  return (
    <section ref={firstItemRef} className="rounded-[32px] border border-zinc-800/80 bg-zinc-950/72 p-5 shadow-2xl shadow-black/30">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/75">Нужен выбор тренера</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">Требуют действия</h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-zinc-500">
          Только спортсмены, у которых тренировочный процесс сейчас заблокирован.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3 2xl:grid-cols-5">
        {visibleClients.map((client, index) => (
          <ActionQueueItem
            key={client.id}
            client={client}
            isFirst={index === 0}
            onComplete={onComplete}
            onQuickAssign={onQuickAssign}
            onWorkoutReview={onWorkoutReview}
          />
        ))}
      </div>
      {hiddenCount > 0 ? <p className="mt-3 text-xs text-zinc-600">Ещё {hiddenCount} клиента в очереди.</p> : null}
    </section>
  );
}
