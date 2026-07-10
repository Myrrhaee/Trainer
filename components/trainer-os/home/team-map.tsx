import { ClientStatusLegend } from "./client-status-legend";
import { TeamMemberNode } from "./team-member-node";
import type { TeamClient, TeamClientState, TeamMapFilter } from "./types";

type TeamMapProps = {
  clients: TeamClient[];
  activeFilter: TeamMapFilter;
  onFilterChange: (filter: TeamMapFilter) => void;
};

export function TeamMap({ clients, activeFilter, onFilterChange }: TeamMapProps) {
  const counts = getStateCounts(clients);
  const visibleClients = activeFilter === "all" ? clients : clients.filter((client) => client.state === activeFilter);

  return (
    <section className="overflow-hidden rounded-[36px] border border-zinc-800/80 bg-[radial-gradient(circle_at_50%_45%,rgba(190,242,100,0.08),transparent_28%),linear-gradient(135deg,rgba(24,24,27,0.72),rgba(5,5,5,0.84))] p-5 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Карта команды</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">Штаб частной команды</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
            В центре — спортсмены, которым нужен выбор тренера. Остальная команда видна вокруг и остаётся спокойной.
          </p>
        </div>
        <ClientStatusLegend counts={counts} activeFilter={activeFilter} onFilterChange={onFilterChange} />
      </div>

      <div className="relative mt-5 min-h-[520px] overflow-hidden rounded-[32px] border border-zinc-800/70 bg-[radial-gradient(circle_at_50%_48%,rgba(39,39,42,0.9),rgba(9,9,11,0.96)_58%,rgba(5,5,5,0.98))]">
        <div className="absolute left-1/2 top-1/2 size-[19rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-lime-300/10" />
        <div className="absolute left-1/2 top-1/2 size-[31rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-800/80" />
        <div className="absolute left-1/2 top-1/2 size-[43rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-900" />
        <div className="absolute left-5 top-5 rounded-full border border-zinc-800/80 bg-black/24 px-3 py-1.5 text-xs text-zinc-500">
          {visibleClients.length} на карте
        </div>
        {visibleClients.map((client) => (
          <TeamMemberNode key={client.id} client={client} {...getNodePlacement(client.id, client.state)} />
        ))}
      </div>
    </section>
  );
}

function getStateCounts(clients: TeamClient[]): Record<TeamClientState, number> {
  return {
    on_track: clients.filter((client) => client.state === "on_track").length,
    no_next_workout: clients.filter((client) => client.state === "no_next_workout").length,
    waiting_review: clients.filter((client) => client.state === "waiting_review").length,
    needs_adjustment: clients.filter((client) => client.state === "needs_adjustment").length,
    inactive: clients.filter((client) => client.state === "inactive").length,
  };
}

function getNodePlacement(id: string, state: TeamClientState) {
  const fallback = nodePlacements[id] ?? { x: 50, y: 50 };
  const isActionState = ["no_next_workout", "waiting_review", "needs_adjustment"].includes(state);

  return {
    ...fallback,
    size: isActionState ? "lg" : state === "inactive" ? "sm" : "md",
  } as const;
}

const nodePlacements: Record<string, { x: number; y: number }> = {
  "artem-smirnov": { x: 47, y: 43 },
  "olga-sokolova": { x: 57, y: 52 },
  "egor-nikitin": { x: 39, y: 55 },
  "maria-volkova": { x: 25, y: 28 },
  "dmitry-korolev": { x: 34, y: 21 },
  "sofia-andreeva": { x: 47, y: 18 },
  "nikita-ivanov": { x: 61, y: 21 },
  "anna-petrova": { x: 73, y: 29 },
  "kirill-orlov": { x: 79, y: 44 },
  "elena-kuznetsova": { x: 75, y: 62 },
  "roman-belov": { x: 63, y: 75 },
  "polina-gromova": { x: 49, y: 81 },
  "ivan-melnikov": { x: 35, y: 76 },
  "alisa-zvereva": { x: 23, y: 63 },
  "maxim-ustinov": { x: 19, y: 45 },
  "veronika-levina": { x: 31, y: 39 },
  "pavel-sergeev": { x: 66, y: 38 },
  "yana-fedotova": { x: 53, y: 66 },
  "timur-akimov": { x: 42, y: 68 },
  "irina-kozlova": { x: 58, y: 30 },
  "leonid-savin": { x: 29, y: 51 },
  "ksenia-belyaeva": { x: 84, y: 78 },
  "vadim-larin": { x: 14, y: 78 },
  "natalia-ershova": { x: 88, y: 23 },
};
