"use client";

import { type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ActionStoryCard } from "./action-story-card";
import { CalmActionState } from "./calm-action-state";
import { SelectedClientPreview } from "./selected-client-preview";
import type { TeamClient } from "./types";

type ActionStoriesCarouselProps = {
  clients: TeamClient[];
  selectedClient: TeamClient | null;
  selectedClientId: string | null;
  firstItemRef: RefObject<HTMLElement | null>;
  onSelectClient: (client: TeamClient) => void;
  onComplete: (clientId: string) => void;
};

export function ActionStoriesCarousel({
  clients,
  selectedClient,
  selectedClientId,
  firstItemRef,
  onSelectClient,
  onComplete,
}: ActionStoriesCarouselProps) {
  const selectedUrgentClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const decisionClient = selectedUrgentClient ?? clients[0] ?? null;
  const selectedCalmClient = selectedClient && !selectedUrgentClient ? selectedClient : null;
  const activeIndex = decisionClient ? clients.findIndex((client) => client.id === decisionClient.id) : -1;
  const hasUrgentQueue = clients.length > 0;

  function selectByOffset(offset: -1 | 1) {
    if (!decisionClient || clients.length === 0) return;

    const currentIndex = Math.max(0, clients.findIndex((client) => client.id === decisionClient.id));
    const nextIndex = (currentIndex + offset + clients.length) % clients.length;
    onSelectClient(clients[nextIndex]);
  }

  return (
    <section ref={firstItemRef} className="rounded-[2rem] border border-zinc-800/80 bg-zinc-950/90 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Решение тренера</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50">Следующее решение</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            {hasUrgentQueue
              ? "Начните с клиента, у которого заблокирован тренировочный процесс."
              : "Команда движется по плану."}
          </p>
        </div>

        {clients.length > 1 ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => selectByOffset(-1)}
              className="flex size-9 items-center justify-center rounded-full border border-zinc-800 bg-black/20 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
              aria-label="Предыдущее решение"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => selectByOffset(1)}
              className="flex size-9 items-center justify-center rounded-full border border-zinc-800 bg-black/20 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
              aria-label="Следующее решение"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}
      </div>

      {selectedCalmClient ? (
        <div className="mt-5 space-y-4">
          <SelectedClientPreview client={selectedCalmClient} />
          {clients.length > 0 ? (
            <button
              type="button"
              onClick={() => onSelectClient(clients[0])}
              className="inline-flex h-9 items-center rounded-full border border-zinc-800 bg-black/20 px-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
            >
              Вернуться к решениям · {clients.length}
            </button>
          ) : null}
        </div>
      ) : decisionClient ? (
        <>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => onSelectClient(client)}
                  className={`h-1.5 rounded-full transition-all ${
                    decisionClient.id === client.id ? "w-8 bg-lime-300" : "w-3 bg-zinc-800 hover:bg-zinc-700"
                  }`}
                  aria-label={`Перейти к решению ${client.name}`}
                />
              ))}
            </div>
            <p className="text-xs text-zinc-600">
              {activeIndex + 1} из {clients.length}
            </p>
          </div>

          <div className="mt-4">
            <ActionStoryCard
              dataClientId={decisionClient.id}
              client={decisionClient}
              active
              onComplete={onComplete}
            />
          </div>
        </>
      ) : (
        <CalmActionState />
      )}
    </section>
  );
}
