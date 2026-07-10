"use client";

import Image from "next/image";
import { CheckCircle2, Dumbbell, Flame, Lock, Star, Trophy } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { buildAchievementCatalogForAthlete } from "./achievement-catalog";
import type { AthleteAchievement, AthleteProfile } from "./types";

type AchievementCatalogDialogProps = {
  athlete: AthleteProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AchievementCatalogDialog({ athlete, open, onOpenChange }: AchievementCatalogDialogProps) {
  const achievements = buildAchievementCatalogForAthlete(athlete.achievements);
  const unlockedCount = achievements.filter((achievement) => achievement.status === "unlocked").length;
  const totalScore = achievements
    .filter((achievement) => achievement.status === "unlocked")
    .reduce((sum, achievement) => sum + (achievement.score ?? 0), 0);
  const soonAchievements = achievements
    .filter((achievement) => achievement.status === "in_progress")
    .sort((a, b) => achievementProgressValue(b) - achievementProgressValue(a))
    .slice(0, 4);
  const inProgressCount = achievements.filter((achievement) => achievement.status === "in_progress").length;
  const lockedCount = achievements.filter((achievement) => achievement.status === "locked").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-1.5rem)] !max-w-[1120px] overflow-hidden rounded-[32px] border-zinc-800 bg-zinc-950/98 p-0 text-zinc-100 sm:w-[calc(100vw-3rem)]">
        <DialogHeader className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-600">Achievement catalog</p>
              <DialogTitle className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
                Достижения {athlete.name}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                Полный каталог наград клиента: открытые достижения, ближайшие цели и закрытые уровни.
              </DialogDescription>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <AchievementDialogStat label="Открыто" value={`${unlockedCount}/${achievements.length}`} />
              <AchievementDialogStat label="Скоро" value={`${soonAchievements.length}`} />
              <AchievementDialogStat label="Score" value={`${totalScore}`} />
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(88vh-150px)] overflow-y-auto px-5 py-5 sm:px-6">
          {soonAchievements.length > 0 ? (
            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-50">Скоро получит</h3>
                  <p className="mt-1 text-sm text-zinc-500">Достижения, которые ближе всего к открытию.</p>
                </div>
                <span className="rounded-full border border-amber-300/18 bg-amber-300/8 px-3 py-1.5 text-xs text-amber-100">
                  ближайшие цели
                </span>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {soonAchievements.map((achievement) => (
                  <SoonAchievementRow key={achievement.id} achievement={achievement} />
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-[28px] border border-lime-300/14 bg-lime-300/6 p-5">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-50">Все ближайшие цели закрыты</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                У клиента нет достижений в активном прогрессе. Следующие появятся после новых тренировок, чек-инов или замеров.
              </p>
            </section>
          )}

          <section className="mt-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-zinc-50">Все достижения</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Получено: {unlockedCount} · в прогрессе: {inProgressCount} · закрыто: {lockedCount}
                </p>
              </div>
              <span className="rounded-full border border-zinc-800 bg-black/20 px-3 py-1.5 text-xs text-zinc-500">
                {achievements.length} наград
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {achievements.map((achievement) => (
                <AchievementCatalogCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AchievementDialogStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-zinc-800 bg-black/24 p-3">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

function SoonAchievementRow({ achievement }: { achievement: AthleteAchievement }) {
  const progress = achievementProgressValue(achievement);

  return (
    <article className="flex gap-4 rounded-[28px] border border-zinc-800 bg-black/22 p-3">
      <div className="relative flex size-20 shrink-0 items-center justify-center">
        {achievement.assetSrc ? (
          <Image
            src={achievement.assetSrc}
            alt={achievement.title}
            width={80}
            height={80}
            className="size-20 object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.38)]"
            sizes="80px"
          />
        ) : (
          <div
            className={cn(
              "flex size-16 items-center justify-center rounded-[22px] border",
              achievementMedalClass(achievement.rarity, achievement.status)
            )}
          >
            <AchievementIconGlyph category={achievement.category} status={achievement.status} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-zinc-800 bg-black/20 px-2 py-1 text-[11px] text-zinc-500">
            {achievement.collection ?? "Коллекция"}
          </span>
          <span className={cn("rounded-full border px-2 py-1 text-[11px]", achievementStatusClass(achievement.status))}>
            {progress}%
          </span>
        </div>
        <h4 className="mt-2 text-sm font-semibold text-zinc-50">{achievement.title}</h4>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-500">{achievement.description}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-900">
          <div className="h-full rounded-full bg-lime-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-zinc-600">{achievement.progress?.label ?? achievement.levelId ?? achievement.id}</p>
      </div>
    </article>
  );
}

function AchievementCatalogCard({ achievement }: { achievement: AthleteAchievement }) {
  const progress = achievementProgressValue(achievement);

  return (
    <article className={cn("group min-w-0 overflow-hidden rounded-[30px] border p-4 transition duration-300", achievementSurfaceClass(achievement.rarity, achievement.status))}>
      <div className="flex items-start justify-between gap-3">
        <span className={cn("rounded-full border px-2.5 py-1 text-[11px]", achievementStatusClass(achievement.status))}>
          {achievementStatusLabel(achievement.status)}
        </span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-600">
          {achievementTierLabel(achievement.tier) ?? achievement.rarity}
        </span>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="relative flex size-32 items-center justify-center">
          <div className="absolute bottom-1 h-6 w-24 rounded-full bg-black/40 blur-xl" />
          {achievement.assetSrc ? (
            <Image
              src={achievement.assetSrc}
              alt={achievement.title}
              width={128}
              height={128}
              className={cn(
                "relative z-10 size-32 object-contain drop-shadow-[0_22px_32px_rgba(0,0,0,0.42)] transition duration-300 group-hover:scale-[1.04]",
                achievement.status === "locked" && "grayscale opacity-45",
                achievement.status === "in_progress" && "opacity-88"
              )}
              sizes="128px"
            />
          ) : (
            <div
              className={cn(
                "relative z-10 flex size-24 items-center justify-center rounded-[30px] border",
                achievementMedalClass(achievement.rarity, achievement.status)
              )}
            >
              <div className="absolute inset-3 rounded-[22px] border border-white/6 bg-black/22" />
              <AchievementIconGlyph category={achievement.category} status={achievement.status} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 min-h-[98px]">
        <p className="line-clamp-1 text-xs text-zinc-600">{achievement.collection ?? achievement.collectionId ?? "Каталог"}</p>
        <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-zinc-50">{achievement.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">{achievement.description}</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-zinc-600">
        <span className="line-clamp-1">{achievement.levelId ?? achievement.id}</span>
        {typeof achievement.score === "number" && achievement.score > 0 ? (
          <span className="shrink-0 text-lime-200/80">+{achievement.score}</span>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
          <div
            className={cn("h-full rounded-full transition-all duration-500", achievement.status === "locked" ? "bg-zinc-600" : "bg-lime-300")}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          {achievement.status === "unlocked"
            ? `Получено · ${achievement.unlockedAt ?? "система"}`
            : achievement.progress?.label ?? "Пока закрыто"}
        </p>
      </div>
    </article>
  );
}

function AchievementIconGlyph({
  category,
  status,
}: {
  category: AthleteAchievement["category"];
  status: AthleteAchievement["status"];
}) {
  const className = "relative z-10 size-9";

  if (status === "locked") {
    return <Lock className={className} />;
  }

  if (category === "training") {
    return <Dumbbell className={className} />;
  }

  if (category === "progress") {
    return <Trophy className={className} />;
  }

  if (category === "consistency") {
    return <Flame className={className} />;
  }

  if (category === "strength") {
    return <Star className={className} />;
  }

  return <CheckCircle2 className={className} />;
}

function achievementStatusLabel(status: AthleteAchievement["status"]) {
  return {
    unlocked: "получено",
    in_progress: "в прогрессе",
    locked: "закрыто",
  }[status];
}

function achievementStatusClass(status: AthleteAchievement["status"]) {
  return {
    unlocked: "border-lime-300/18 bg-lime-300/8 text-lime-100",
    in_progress: "border-amber-300/18 bg-amber-300/8 text-amber-100",
    locked: "border-zinc-800 bg-black/20 text-zinc-500",
  }[status];
}

function achievementProgressValue(achievement: AthleteAchievement) {
  if (achievement.progress) {
    return Math.min(100, Math.max(0, Math.round((achievement.progress.current / achievement.progress.target) * 100)));
  }

  return achievement.status === "unlocked" ? 100 : 0;
}

function achievementTierLabel(tier: AthleteAchievement["tier"]) {
  if (!tier) return null;

  return {
    bronze: "бронза",
    silver: "серебро",
    gold: "золото",
    master: "мастер",
    cup: "кубок",
    secret: "секретное",
  }[tier];
}

function achievementSurfaceClass(rarity: AthleteAchievement["rarity"], status: AthleteAchievement["status"]) {
  if (status === "locked") {
    return "border-zinc-800 bg-zinc-950/54 opacity-70";
  }

  return {
    base: "border-zinc-800 bg-black/22 hover:border-lime-300/20",
    rare: "border-lime-300/16 bg-[radial-gradient(circle_at_30%_0%,rgba(190,242,100,0.12),transparent_40%),rgba(0,0,0,0.22)] hover:border-lime-300/28",
    epic: "border-amber-300/18 bg-[radial-gradient(circle_at_30%_0%,rgba(251,191,36,0.12),transparent_42%),rgba(0,0,0,0.24)] hover:border-amber-300/28",
  }[rarity];
}

function achievementMedalClass(rarity: AthleteAchievement["rarity"], status: AthleteAchievement["status"]) {
  if (status === "locked") {
    return "border-zinc-800 bg-zinc-950 text-zinc-600";
  }

  return {
    base: "border-zinc-700 bg-[linear-gradient(135deg,#18181b,#050505)] text-lime-200 shadow-[0_20px_44px_rgba(0,0,0,0.3)]",
    rare: "border-lime-300/24 bg-[linear-gradient(135deg,rgba(190,242,100,0.14),#050505)] text-lime-200 shadow-[0_20px_52px_rgba(132,204,22,0.12)]",
    epic: "border-amber-300/24 bg-[linear-gradient(135deg,rgba(251,191,36,0.14),#050505)] text-amber-100 shadow-[0_20px_52px_rgba(251,191,36,0.12)]",
  }[rarity];
}
