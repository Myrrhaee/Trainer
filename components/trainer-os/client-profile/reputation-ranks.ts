import type { AthleteReputation, AthleteReputationRank, AthleteReputationRankId } from "./types";

export const athleteReputationRanks: AthleteReputationRank[] = [
  {
    id: "CONTENDER_I",
    name: "Претендент I",
    group: "Претендент",
    division: 1,
    minScore: 0,
    asset: "/ranks/v1/contender-i.png",
  },
  {
    id: "CONTENDER_II",
    name: "Претендент II",
    group: "Претендент",
    division: 2,
    minScore: 200,
    asset: "/ranks/v1/contender-ii.png",
  },
  {
    id: "CONTENDER_III",
    name: "Претендент III",
    group: "Претендент",
    division: 3,
    minScore: 450,
    asset: "/ranks/v1/contender-iii.png",
  },
  {
    id: "SPORTSMAN_I",
    name: "Спортсмен I",
    group: "Спортсмен",
    division: 1,
    minScore: 750,
    asset: "/ranks/v1/sportsman-i.png",
  },
  {
    id: "SPORTSMAN_II",
    name: "Спортсмен II",
    group: "Спортсмен",
    division: 2,
    minScore: 1100,
    asset: "/ranks/v1/sportsman-ii.png",
  },
  {
    id: "SPORTSMAN_III",
    name: "Спортсмен III",
    group: "Спортсмен",
    division: 3,
    minScore: 1500,
    asset: "/ranks/v1/sportsman-iii.png",
  },
  {
    id: "ATHLETE_I",
    name: "Атлет I",
    group: "Атлет",
    division: 1,
    minScore: 2000,
    asset: "/ranks/v1/athlete-i.png",
  },
  {
    id: "ATHLETE_II",
    name: "Атлет II",
    group: "Атлет",
    division: 2,
    minScore: 2600,
    asset: "/ranks/v1/athlete-ii.png",
  },
  {
    id: "ATHLETE_III",
    name: "Атлет III",
    group: "Атлет",
    division: 3,
    minScore: 3300,
    asset: "/ranks/v1/athlete-iii.png",
  },
  {
    id: "ELITE_I",
    name: "Элита I",
    group: "Элита",
    division: 1,
    minScore: 4100,
    asset: "/ranks/v1/elite-i.png",
  },
  {
    id: "ELITE_II",
    name: "Элита II",
    group: "Элита",
    division: 2,
    minScore: 5000,
    asset: "/ranks/v1/elite-ii.png",
  },
  {
    id: "ELITE_III",
    name: "Элита III",
    group: "Элита",
    division: 3,
    minScore: 6000,
    asset: "/ranks/v1/elite-iii.png",
  },
  {
    id: "CHAMPION_I",
    name: "Чемпион I",
    group: "Чемпион",
    division: 1,
    minScore: 7200,
    asset: "/ranks/v1/champion-i.png",
  },
  {
    id: "CHAMPION_II",
    name: "Чемпион II",
    group: "Чемпион",
    division: 2,
    minScore: 8500,
    asset: "/ranks/v1/champion-ii.png",
  },
  {
    id: "CHAMPION_III",
    name: "Чемпион III",
    group: "Чемпион",
    division: 3,
    minScore: 9900,
    asset: "/ranks/v1/champion-iii.png",
  },
  {
    id: "LEGEND_I",
    name: "Легенда I",
    group: "Легенда",
    division: 1,
    minScore: 11500,
    asset: "/ranks/v1/legend-i.png",
  },
  {
    id: "LEGEND_II",
    name: "Легенда II",
    group: "Легенда",
    division: 2,
    minScore: 13200,
    asset: "/ranks/v1/legend-ii.png",
  },
  {
    id: "LEGEND_III",
    name: "Легенда III",
    group: "Легенда",
    division: 3,
    minScore: 15000,
    asset: "/ranks/v1/legend-iii.png",
  },
];

export function getAthleteReputationView(reputation: AthleteReputation) {
  const rankIndex = Math.max(
    athleteReputationRanks.findIndex((rank) => rank.id === reputation.rankId),
    0
  );
  const rank = athleteReputationRanks[rankIndex] ?? athleteReputationRanks[0];
  const nextRank = athleteReputationRanks[rankIndex + 1] ?? null;

  return {
    rank: rank.name,
    subtitle: nextRank ? `Следующий ранг: ${nextRank.name}` : "Максимальный ранг",
    progress: reputation.progress,
    stars: rank.division,
    score: reputation.score,
    asset: rank.asset,
    nextRank: nextRank?.name ?? null,
  };
}

export function isAthleteReputationRankId(rankId: string): rankId is AthleteReputationRankId {
  return athleteReputationRanks.some((rank) => rank.id === rankId);
}
